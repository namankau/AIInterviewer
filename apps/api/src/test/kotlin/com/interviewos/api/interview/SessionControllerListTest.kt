package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerListTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var interviewService: InterviewService

    @MockitoBean private lateinit var reportService: ReportService

    @MockitoBean private lateinit var readinessService: ReadinessService

    @MockitoBean private lateinit var roundDeletion: RoundDeletion

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `lists one bounded page for the authenticated candidate`() {
        given(interviewService.list(candidate, 5, 10)).willReturn(emptyList())

        mockMvc
            .perform(get("/api/v1/sessions").param("limit", "5").param("offset", "10").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isArray)

        verify(interviewService).list(candidate, 5, 10)
    }

    @Test
    fun `defaults to twenty recent sessions`() {
        mockMvc
            .perform(get("/api/v1/sessions").with(token()))
            .andExpect(status().isOk)

        verify(interviewService).list(candidate, 20, 0)
    }

    @Test
    fun `rejects a history request without a token`() {
        mockMvc
            .perform(get("/api/v1/sessions"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error").value("unauthorized"))

        verifyNoInteractions(interviewService)
    }

    private fun token() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(candidate.toString()).claim("email", "candidate@example.com")
        }
}
