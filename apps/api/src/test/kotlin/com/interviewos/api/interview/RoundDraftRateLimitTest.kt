package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * The composer calls a model on every request, outside any round's clock, so it is capped
 * per account per hour. Past the cap the model is never reached.
 */
@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
@TestPropertySource(properties = ["interviewos.rate-limit.round-drafts-per-hour=2"])
class RoundDraftRateLimitTest {
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

    @Test
    fun `answers 429 with Retry-After once an account passes its hourly cap`() {
        repeat(2) { draft("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11").andExpect(status().isOk) }

        draft("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error").value("rate_limited"))
            .andExpect(header().exists("Retry-After"))

        // Another account still has its own allowance.
        draft("11111111-2222-3333-4444-555555555555").andExpect(status().isOk)
        verify(interviewService, times(3)).composeRound(ComposeRoundRequest("Infosys MR round"))
    }

    private fun draft(subject: String) =
        mockMvc.perform(
            post("/api/v1/round-drafts")
                .with(
                    jwt().jwt { builder: Jwt.Builder ->
                        builder.subject(subject).claim("email", "candidate@example.com")
                    },
                ).contentType(MediaType.APPLICATION_JSON)
                .content("""{"query":"Infosys MR round"}"""),
        )
}
