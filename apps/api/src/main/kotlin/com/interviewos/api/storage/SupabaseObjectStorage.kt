package com.interviewos.api.storage

import com.interviewos.api.common.ContentTypes
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * [ObjectStorage] backed by the Supabase Storage REST API, authenticated with the
 * service-role key. Boundary code: mocked in tests, never called by one.
 */
@Component
class SupabaseObjectStorage(
    private val properties: StorageProperties,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder,
) : ObjectStorage {
    private val restClient = restClientBuilder.build()

    override fun upload(
        bucket: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
    ) {
        requireConfigured()
        try {
            restClient
                .post()
                .uri("${properties.restBaseUrl}/object/$bucket/$path")
                .headers { it.setBearerAuth(properties.serviceRoleKey) }
                .header("apikey", properties.serviceRoleKey)
                .header("x-upsert", "true")
                .contentType(mediaTypeOf(contentType))
                .body(bytes)
                .retrieve()
                .toBodilessEntity()
        } catch (ex: RestClientException) {
            throw ObjectStorageException("Failed to upload $bucket/$path.", ex)
        }
    }

    override fun download(
        bucket: String,
        path: String,
    ): ByteArray {
        requireConfigured()
        return try {
            restClient
                .get()
                .uri("${properties.restBaseUrl}/object/$bucket/$path")
                .headers { it.setBearerAuth(properties.serviceRoleKey) }
                .header("apikey", properties.serviceRoleKey)
                .retrieve()
                .body(ByteArray::class.java)
                ?: throw ObjectStorageException("Empty download for $bucket/$path.")
        } catch (ex: RestClientException) {
            throw ObjectStorageException("Failed to download $bucket/$path.", ex)
        }
    }

    override fun createSignedUrl(
        bucket: String,
        path: String,
        expiresInSeconds: Int,
    ): String {
        requireConfigured()
        return try {
            val response =
                restClient
                    .post()
                    .uri("${properties.restBaseUrl}/object/sign/$bucket/$path")
                    .headers { it.setBearerAuth(properties.serviceRoleKey) }
                    .header("apikey", properties.serviceRoleKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(mapOf("expiresIn" to expiresInSeconds))
                    .retrieve()
                    .body(JsonNode::class.java)
            val signed = response?.path("signedURL")?.asString()
            if (signed.isNullOrBlank()) throw ObjectStorageException("No signed URL returned for $bucket/$path.")
            "${properties.supabaseUrl.trimEnd('/')}/storage/v1$signed"
        } catch (ex: RestClientException) {
            throw ObjectStorageException("Failed to sign $bucket/$path.", ex)
        }
    }

    override fun deleteByPrefix(
        bucket: String,
        prefix: String,
    ) {
        requireConfigured()
        try {
            deleteFolder(bucket, prefix, depth = 0)
        } catch (ex: RestClientException) {
            throw ObjectStorageException("Failed to delete objects under $bucket/$prefix.", ex)
        }
    }

    /**
     * Supabase lists one folder level at a time and at most [LIST_PAGE] entries, and a
     * sub-folder comes back as an entry with no `id`. A round's prefix is flat, but an
     * account's (`{userId}`) holds one folder per round, so files are deleted page by page
     * and every sub-folder is walked — otherwise deleting an account would delete nothing
     * but its resumes.
     */
    private fun deleteFolder(
        bucket: String,
        folder: String,
        depth: Int,
    ) {
        if (depth > MAX_DEPTH) throw ObjectStorageException("Refusing to walk deeper than $MAX_DEPTH folders under $bucket/$folder.")
        val subFolders = linkedSetOf<String>()
        var pages = 0
        while (true) {
            val entries = list(bucket, folder)
            val files = entries.filter { !it.isFolder }.map { "$folder/${it.name}" }
            entries.filter { it.isFolder }.forEach { subFolders += "$folder/${it.name}" }
            if (files.isNotEmpty()) remove(bucket, files)
            // A full page of files may have more behind it; deleting them moved the rest up.
            if (files.size < LIST_PAGE) break
            // Bounded, so a delete that silently removes nothing fails the job (and is
            // retried later) instead of listing the same page forever.
            if (++pages >= MAX_PAGES) throw ObjectStorageException("Gave up after $MAX_PAGES pages under $bucket/$folder.")
        }
        subFolders.forEach { deleteFolder(bucket, it, depth + 1) }
    }

    private fun list(
        bucket: String,
        folder: String,
    ): List<ListedEntry> {
        val listing =
            restClient
                .post()
                .uri("${properties.restBaseUrl}/object/list/$bucket")
                .headers { it.setBearerAuth(properties.serviceRoleKey) }
                .header("apikey", properties.serviceRoleKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("prefix" to folder, "limit" to LIST_PAGE))
                .retrieve()
                .body(JsonNode::class.java)
        return listing?.mapNotNull { node ->
            val name = node.path("name").asString()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val id = node.path("id")
            ListedEntry(name, isFolder = id.isMissingNode || id.isNull)
        } ?: emptyList()
    }

    private fun remove(
        bucket: String,
        paths: List<String>,
    ) {
        restClient
            .method(org.springframework.http.HttpMethod.DELETE)
            .uri("${properties.restBaseUrl}/object/$bucket")
            .headers { it.setBearerAuth(properties.serviceRoleKey) }
            .header("apikey", properties.serviceRoleKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("prefixes" to paths))
            .retrieve()
            .toBodilessEntity()
    }

    private data class ListedEntry(
        val name: String,
        val isFolder: Boolean,
    )

    private companion object {
        const val LIST_PAGE = 1000

        /** `{userId}/{sessionId}/file` is two levels; anything far deeper is a bug, not data. */
        const val MAX_DEPTH = 8

        const val MAX_PAGES = 100
    }

    /**
     * Browser recordings carry codec parameters that are not legal HTTP tokens
     * (`video/webm;codecs=vp9,opus`), and a parse failure here would abort the upload.
     * A valid type is kept as sent; anything else falls back to its bare type/subtype.
     */
    private fun mediaTypeOf(contentType: String): MediaType =
        runCatching { MediaType.parseMediaType(contentType) }
            .getOrElse { MediaType.parseMediaType(ContentTypes.base(contentType)) }

    private fun requireConfigured() {
        if (!properties.configured) {
            throw ObjectStorageException("Supabase storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        }
    }
}
