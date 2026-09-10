package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * `DELETE /api/v1/sessions/{id}` — the route that destroys a candidate's round.
 *
 * The only identity this endpoint may act on is the one in the verified token. There is
 * no user id in the path, none in a body, and the test that matters most below is the one
 * proving the id the service is handed is the token subject rather than anything the
 * caller supplied.
 */
@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerDeleteTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var interviewService: InterviewService

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    private val candidate: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val otherCandidate: UUID = UUID.fromString("11111111-2222-3333-4444-555555555555")
    private val sessionId: UUID = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `deletes the caller's own round and returns no content`() {
        mockMvc
            .perform(delete("/api/v1/sessions/$sessionId").with(tokenFor(candidate)))
            .andExpect(status().isNoContent)

        // The subject of the token, not a parameter of the request.
        verify(roundDeletion).delete(candidate, sessionId)
    }

    /**
     * User A asking for user B's round. The service reports it as absent and the API says
     * 404 — the same answer as for a session id that never existed, which is the point.
     * A 403 would confirm that the round is real and simply belongs to somebody else, and
     * that is a fact about another candidate that this caller is not entitled to.
     */
    @Test
    fun `cannot delete a round belonging to another candidate`() {
        willThrow(ApiException.notFound())
            .given(roundDeletion)
            .delete(otherCandidate, sessionId)

        mockMvc
            .perform(delete("/api/v1/sessions/$sessionId").with(tokenFor(otherCandidate)))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))

        verify(roundDeletion).delete(otherCandidate, sessionId)
    }

    @Test
    fun `rejects a delete with no token`() {
        mockMvc
            .perform(delete("/api/v1/sessions/$sessionId"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error").value("unauthorized"))

        // An unauthenticated caller must never reach the deletion.
        verifyNoInteractions(roundDeletion)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
