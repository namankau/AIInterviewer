package com.interviewos.api.sources

import com.interviewos.api.bank.SourceOrigin
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
import java.time.LocalDate
import java.time.format.DateTimeParseException
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
                origin = parseOrigin(request.origin),
                publishedOn = parsePublishedOn(request.publishedOn),
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
        @RequestParam(required = false) origin: String?,
        @RequestParam(required = false) publishedOn: String?,
    ): SourceView {
        val admin = adminAccess.require(SupabaseIdentity.from(jwt))
        val sourceOrigin = parseOrigin(origin)
        val published = parsePublishedOn(publishedOn)
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
                origin = sourceOrigin,
                publishedOn = published,
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

    /**
     * `employer`, `open_licence` or `author`, or nothing. Anything else is refused rather
     * than stored as null: the origin is shown to candidates beside every citation, and a
     * typo quietly dropped would turn an employer's own page into an unlabelled one.
     */
    private fun parseOrigin(value: String?): SourceOrigin? {
        val clean = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return SourceOrigin.fromDbValue(clean.lowercase())
            ?: throw ApiException.badRequest(
                "origin needs to be one of: employer, open_licence, author.",
                code = "unsupported_origin",
            )
    }

    /** An ISO date, `YYYY-MM-DD`, only if the source states one. */
    private fun parsePublishedOn(value: String?): LocalDate? {
        val clean = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return try {
            LocalDate.parse(clean)
        } catch (e: DateTimeParseException) {
            throw ApiException.badRequest("publishedOn needs to be a date, YYYY-MM-DD.", code = "invalid_date")
        }
    }

    /** Removes a source, every report it made, and bank questions nothing else reports. */
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
            origin = origin?.dbValue,
            publishedOn = publishedOn?.toString(),
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
    /** How we may use it: `employer`, `open_licence` or `author`. Shown with every citation. */
    val origin: String? = null,
    /** `YYYY-MM-DD`, only if the source states it. */
    val publishedOn: String? = null,
)

data class SourceView(
    val id: UUID,
    val kind: String,
    val url: String?,
    val title: String?,
    val publisher: String?,
    val companyName: String?,
    val origin: String?,
    val publishedOn: String?,
    val status: String,
    val lastFetchedAt: String?,
    val fetchError: String?,
    val questionCount: Int,
)
