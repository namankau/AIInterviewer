package com.interviewos.api.storage

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
                .contentType(MediaType.parseMediaType(contentType))
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
            val listing =
                restClient
                    .post()
                    .uri("${properties.restBaseUrl}/object/list/$bucket")
                    .headers { it.setBearerAuth(properties.serviceRoleKey) }
                    .header("apikey", properties.serviceRoleKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(mapOf("prefix" to prefix, "limit" to 1000))
                    .retrieve()
                    .body(JsonNode::class.java)
            val names =
                listing?.mapNotNull { node ->
                    node
                        .path("name")
                        .asString()
                        ?.takeIf { it.isNotBlank() }
                        ?.let { "$prefix/$it" }
                }
                    ?: emptyList()
            if (names.isEmpty()) return
            restClient
                .method(org.springframework.http.HttpMethod.DELETE)
                .uri("${properties.restBaseUrl}/object/$bucket")
                .headers { it.setBearerAuth(properties.serviceRoleKey) }
                .header("apikey", properties.serviceRoleKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("prefixes" to names))
                .retrieve()
                .toBodilessEntity()
        } catch (ex: RestClientException) {
            throw ObjectStorageException("Failed to delete objects under $bucket/$prefix.", ex)
        }
    }

    private fun requireConfigured() {
        if (!properties.configured) {
            throw ObjectStorageException("Supabase storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        }
    }
}
