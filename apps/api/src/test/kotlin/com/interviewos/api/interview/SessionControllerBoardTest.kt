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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerBoardTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var mapper: ObjectMapper

    @MockitoBean
    private lateinit var interviewService: InterviewService

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `sends valid board JSON to the service as the authenticated candidate`() {
        val json = """{"kind":"dsa","sources":{"python":"print(1)"}}"""

        mockMvc
            .perform(put("/api/v1/sessions/$sessionId/board").with(candidateToken()).contentType(MediaType.APPLICATION_JSON).content(json))
            .andExpect(status().isNoContent)

        verify(interviewService).saveBoard(candidate, sessionId, mapper.readTree(json))
    }

    @Test
    fun `rejects a board request over five mebibytes before parsing it`() {
        mockMvc
            .perform(
                put("/api/v1/sessions/$sessionId/board")
                    .with(candidateToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(ByteArray(MAX_BOARD_BYTES + 1) { 'x'.code.toByte() }),
            ).andExpect(status().isContentTooLarge)
            .andExpect(jsonPath("$.error").value("board_too_large"))

        verifyNoInteractions(interviewService)
    }

    @Test
    fun `rejects malformed JSON without reaching the service`() {
        mockMvc
            .perform(put("/api/v1/sessions/$sessionId/board").with(candidateToken()).contentType(MediaType.APPLICATION_JSON).content("{"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_board"))

        verifyNoInteractions(interviewService)
    }

    @Test
    fun `rejects an unauthenticated board save`() {
        mockMvc
            .perform(put("/api/v1/sessions/$sessionId/board").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(interviewService)
    }

    private fun candidateToken() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(candidate.toString()).claim("email", "candidate@example.com")
        }
}
