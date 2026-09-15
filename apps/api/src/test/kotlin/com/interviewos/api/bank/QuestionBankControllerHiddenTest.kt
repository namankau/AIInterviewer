package com.interviewos.api.bank

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * The bank's list endpoints with `interviewos.question-bank.browsable` at its default, off
 * (task 042): a signed-in candidate gets 404, and the bank is never read to answer them.
 */
@WebMvcTest(QuestionBankController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
@EnableConfigurationProperties(QuestionBankProperties::class)
class QuestionBankControllerHiddenTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var service: QuestionBankService

    @Test
    fun `the company list is not found while the bank is not browsable`() {
        mockMvc
            .perform(get("/api/v1/question-bank/companies").with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(service)
    }

    @Test
    fun `the question list is not found while the bank is not browsable`() {
        mockMvc
            .perform(get("/api/v1/question-bank").param("company", "amazon").with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(service)
    }

    @Test
    fun `the flag is off unless it is set`() {
        kotlin.test.assertEquals(false, QuestionBankProperties().browsable)
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
                .claim("email", "candidate@example.com")
        }
}
