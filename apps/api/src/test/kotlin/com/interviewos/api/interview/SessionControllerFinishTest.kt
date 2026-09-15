package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * `POST /api/v1/sessions/{id}/finish` — the candidate ends the round early and still gets
 * a report.
 *
 * It sits beside `abandon` and must never be confused with it: submitting completes the
 * round and assesses what was answered; abandoning forfeits it. The service is handed the
 * token subject and nothing the caller supplied.
 */
@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerFinishTest {
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
    private val sessionId: UUID = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `completes the caller's own round and says goodbye`() {
        given(interviewService.finish(candidate, sessionId)).willReturn(
            SubmitAnswerResponse(
                sessionComplete = true,
                turnsCompleted = 2,
                nextTurn = null,
                closingRemark = ClosingRemark.forRound(ranOutOfTime = false, endedByCandidate = true),
            ),
        )

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/finish").with(tokenFor(candidate)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.sessionComplete").value(true))
            .andExpect(jsonPath("$.turnsCompleted").value(2))
    }

    /** Nothing answered means nothing to assess, and the API says so rather than inventing a report. */
    @Test
    fun `refuses a round with nothing answered yet`() {
        willThrow(
            ApiException.conflict(
                "Answer at least one question before submitting — there is nothing to assess yet.",
                code = "nothing_to_assess",
            ),
        ).given(interviewService)
            .finish(candidate, sessionId)

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/finish").with(tokenFor(candidate)))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("nothing_to_assess"))
    }

    @Test
    fun `rejects a finish with no token`() {
        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/finish"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(interviewService)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
