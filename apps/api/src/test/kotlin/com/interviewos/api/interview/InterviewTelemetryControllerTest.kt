package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
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
import java.util.UUID

@WebMvcTest(InterviewTelemetryController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class InterviewTelemetryControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var telemetry: InterviewTelemetryService

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `accepts a browser speech failure from an authenticated candidate`() {
        mockMvc
            .perform(
                post("/api/v1/sessions/$sessionId/client-events")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "event": "browser_speech_timed_out",
                          "turnIndex": 2,
                          "durationMs": 15000
                        }
                        """.trimIndent(),
                    ),
            ).andExpect(status().isNoContent)

        verify(telemetry).record(
            candidate,
            sessionId,
            InterviewClientEventRequest("browser_speech_timed_out", 2, 15_000),
        )
    }

    @Test
    fun `rejects a client event without a token`() {
        mockMvc
            .perform(
                post("/api/v1/sessions/$sessionId/client-events")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"event":"model_audio_error","turnIndex":2}"""),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(telemetry)
    }

    @Test
    fun `rejects an invalid turn before calling the service`() {
        mockMvc
            .perform(
                post("/api/v1/sessions/$sessionId/client-events")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"event":"model_audio_error","turnIndex":-1}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("validation_failed"))

        verifyNoInteractions(telemetry)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
