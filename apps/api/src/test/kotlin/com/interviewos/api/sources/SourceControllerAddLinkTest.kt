package com.interviewos.api.sources

import com.interviewos.api.bank.SourceOrigin
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.LocalDate
import java.util.UUID

/**
 * `POST /api/v1/admin/sources/links` with the fields the source register's import sends:
 * the basis we may use a source on, and the date it says it was published.
 */
@WebMvcTest(SourceController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SourceControllerAddLinkTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var repository: SourceRepository

    @MockitoBean
    private lateinit var fetcher: SourceFetcher

    @MockitoBean
    private lateinit var storage: ObjectStorage

    @MockitoBean
    private lateinit var storageProperties: StorageProperties

    @MockitoBean
    private lateinit var adminAccess: AdminAccess

    private val operator = SupabaseIdentity(UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11"), "op@example.com", null)
    private val sourceId = UUID.fromString("10000000-0000-0000-0000-000000000001")

    @Test
    fun `records the origin and publication date it is given`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(
            repository.addLink(
                operator.id,
                "https://amazon.jobs/how-we-hire",
                "How we hire",
                "Amazon",
                "Amazon",
                SourceOrigin.EMPLOYER,
                LocalDate.of(2024, 5, 1),
            ),
        ).willReturn(sourceId)
        given(repository.list()).willReturn(listOf(row()))

        mockMvc
            .perform(
                post("/api/v1/admin/sources/links")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """{"url":"https://amazon.jobs/how-we-hire","title":"How we hire","publisher":"Amazon",""" +
                            """"companyName":"Amazon","origin":"employer","publishedOn":"2024-05-01"}""",
                    ),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.origin").value("employer"))
            .andExpect(jsonPath("$.publishedOn").value("2024-05-01"))

        verify(fetcher).refreshSoon(sourceId)
    }

    @Test
    fun `refuses an origin it does not know rather than dropping it`() {
        given(adminAccess.require(operator)).willReturn(operator)

        mockMvc
            .perform(
                post("/api/v1/admin/sources/links")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"url":"https://example.com/post","origin":"blog"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("unsupported_origin"))

        verifyNoInteractions(repository)
    }

    @Test
    fun `refuses a publication date that is not a date`() {
        given(adminAccess.require(operator)).willReturn(operator)

        mockMvc
            .perform(
                post("/api/v1/admin/sources/links")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"url":"https://example.com/post","publishedOn":"May 2024"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_date"))
    }

    @Test
    fun `rejects a request with no token`() {
        mockMvc
            .perform(
                post("/api/v1/admin/sources/links")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"url":"https://example.com/post"}"""),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(repository)
    }

    private fun row() =
        SourceRow(
            id = sourceId,
            kind = "link",
            url = "https://amazon.jobs/how-we-hire",
            storageBucket = null,
            storagePath = null,
            title = "How we hire",
            publisher = "Amazon",
            publishedOn = LocalDate.of(2024, 5, 1),
            companyName = "Amazon",
            origin = SourceOrigin.EMPLOYER,
            status = "pending",
            lastFetchedAt = null,
            fetchError = null,
            contentHash = null,
            extractorVersion = 1,
            questionCount = 0,
        )

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(operator.id.toString())
                .claim("email", operator.email)
        }
}
