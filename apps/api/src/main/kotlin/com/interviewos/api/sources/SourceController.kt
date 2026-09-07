package com.interviewos.api.sources

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.net.URI
import java.util.UUID

/**
 * Curating the source library: the documents and links the interviewer is allowed to
 * treat as real knowledge about a named employer.
 *
 * Every route is gated on [AdminAccess], which checks the caller's verified email against
 * a configured allow-list. This is not a candidate-facing feature and must never become
 * one: write access here changes what the product asserts about real companies.
 */
@RestController
@RequestMapping("/api/v1/admin/sources")
class SourceController(
    private val repository: SourceRepository,
    private val fetcher: SourceFetcher,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val adminAccess: AdminAccess,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<SourceView> {
        adminAccess.require(SupabaseIdentity.from(jwt))
        return repository.list().map { it.toView() }
    }

    /** Adds a link. Reading it happens in the background; the response does not wait. */
    @PostMapping("/links")
    @ResponseStatus(HttpStatus.CREATED)
    fun addLink(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: AddLinkRequest,
    ): SourceView {
        val admin = adminAccess.require(SupabaseIdentity.from(jwt))

        val url = request.url.trim()
        // Only http(s). A file: or data: URL here would be a way to read the server's own
        // disk through an endpoint whose whole job is fetching what it is given.
        val scheme =
            try {
                URI(url).scheme?.lowercase()
            } catch (e: IllegalArgumentException) {
                null
            }
        if (scheme != "http" && scheme != "https") {
            throw ApiException.badRequest("That needs to be an http or https link.", code = "unsupported_scheme")
        }

        val id =
            repository.addLink(
                addedBy = admin.id,
                url = url,
                title = request.title?.trim()?.takeIf { it.isNotEmpty() },
                publisher = request.publisher?.trim()?.takeIf { it.isNotEmpty() },
                companyName = request.companyName?.trim()?.takeIf { it.isNotEmpty() },
            )
        fetcher.refreshSoon(id)
        return repository.list().first { it.id == id }.toView()
    }

    @PostMapping("/documents")
    @ResponseStatus(HttpStatus.CREATED)
    fun addDocument(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam file: MultipartFile,
        @RequestParam(required = false) title: String?,
        @RequestParam(required = false) publisher: String?,
        @RequestParam(required = false) companyName: String?,
    ): SourceView {
        val admin = adminAccess.require(SupabaseIdentity.from(jwt))
        if (file.isEmpty) {
            throw ApiException.badRequest("That file was empty.", code = "empty_document")
        }

        val path = "library/${UUID.randomUUID()}-${file.originalFilename?.takeLast(80) ?: "document"}"
        storage.upload(storageProperties.mediaBucket, path, file.bytes, file.contentType ?: "application/octet-stream")

        val id =
            repository.addDocument(
                addedBy = admin.id,
                bucket = storageProperties.mediaBucket,
                path = path,
                title = title?.trim()?.takeIf { it.isNotEmpty() } ?: file.originalFilename,
                publisher = publisher?.trim()?.takeIf { it.isNotEmpty() },
                companyName = companyName?.trim()?.takeIf { it.isNotEmpty() },
            )
        fetcher.refreshSoon(id)
        return repository.list().first { it.id == id }.toView()
    }

    /** Re-reads a source now rather than waiting for the refresh timer. */
    @PostMapping("/{id}/refresh")
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun refresh(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) {
        adminAccess.require(SupabaseIdentity.from(jwt))
        fetcher.refreshSoon(id)
    }

    /** Removes a source and, by cascade, every question that cited it. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) {
        adminAccess.require(SupabaseIdentity.from(jwt))
        repository.delete(id)
    }

    private fun SourceRow.toView() =
        SourceView(
            id = id,
            kind = kind,
            url = url,
            title = title,
            publisher = publisher,
            companyName = companyName,
            status = status,
            lastFetchedAt = lastFetchedAt?.toString(),
            fetchError = fetchError,
            questionCount = questionCount,
        )
}

data class AddLinkRequest(
    @field:NotBlank
    val url: String,
    val title: String? = null,
    val publisher: String? = null,
    /** The employer this source is about. Questions inherit it when the text does not say. */
    val companyName: String? = null,
)

data class SourceView(
    val id: UUID,
    val kind: String,
    val url: String?,
    val title: String?,
    val publisher: String?,
    val companyName: String?,
    val status: String,
    val lastFetchedAt: String?,
    val fetchError: String?,
    val questionCount: Int,
)
