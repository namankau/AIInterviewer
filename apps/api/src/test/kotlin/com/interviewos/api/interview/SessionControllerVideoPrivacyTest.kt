package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerVideoPrivacyTest {
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

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `rejects camera video before it reaches the interview service`() {
        val audio = MockMultipartFile("audio", "answer.webm", "audio/webm", byteArrayOf(1, 2, 3))
        val video = MockMultipartFile("video", "camera.webm", "video/webm", byteArrayOf(4, 5, 6))

        mockMvc
            .perform(
                multipart("/api/v1/sessions/$sessionId/turns")
                    .file(audio)
                    .file(video)
                    .param("turnIndex", "0")
                    .with(tokenFor(candidate)),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("video_not_supported"))

        verifyNoInteractions(interviewService)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
