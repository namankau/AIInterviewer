package com.interviewos.api.bank

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
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

/** `GET /api/v1/question-bank/companies` and `GET /api/v1/question-bank` — signed in only. */
@WebMvcTest(QuestionBankController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class QuestionBankControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var service: QuestionBankService

    private val amazon =
        BankCompanyView(
            slug = "amazon",
            name = "Amazon",
            archetype = "global_product",
            archetypeLabel = "Global product company",
            archetypeInProse = "a global product company loop",
            questionCount = 3,
            roundTypes = listOf(RoundTypeCountView("system_design", 2), RoundTypeCountView(null, 1)),
        )

    @Test
    fun `lists the companies with sourced questions and their counts`() {
        given(service.companies()).willReturn(listOf(amazon))

        mockMvc
            .perform(get("/api/v1/question-bank/companies").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].slug").value("amazon"))
            .andExpect(jsonPath("$[0].archetypeLabel").value("Global product company"))
            .andExpect(jsonPath("$[0].questionCount").value(3))
            .andExpect(jsonPath("$[0].roundTypes[0].roundType").value("system_design"))
            .andExpect(jsonPath("$[0].roundTypes[0].count").value(2))
    }

    @Test
    fun `returns a company's questions with every tag and citation`() {
        given(service.page("amazon", "system_design", 20, 0)).willReturn(
            BankQuestionPage(
                company = amazon,
                roundType = "system_design",
                questions =
                    listOf(
                        BankQuestionView(
                            id = UUID.fromString("5418e83d-b49f-4518-a233-518004320d43"),
                            text = "Design a rate limiter",
                            roundType = "system_design",
                            tier = "published_source",
                            corroboration = 2,
                            lastReported = "2025-01-01",
                            companies =
                                listOf(
                                    CompanyTagView("amazon", "Amazon", 1, "2025-01-01"),
                                    CompanyTagView("microsoft", "Microsoft", 1, null),
                                ),
                            citations = listOf(CitationView("How we hire", "Amazon", "https://amazon.jobs/x", 2024, "employer")),
                        ),
                    ),
                total = 1,
                limit = 20,
                offset = 0,
            ),
        )

        mockMvc
            .perform(get("/api/v1/question-bank").param("company", "amazon").param("roundType", "system_design").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.company.name").value("Amazon"))
            .andExpect(jsonPath("$.questions[0].tier").value("published_source"))
            .andExpect(jsonPath("$.questions[0].companies[1].slug").value("microsoft"))
            .andExpect(jsonPath("$.questions[0].citations[0].origin").value("employer"))
            .andExpect(jsonPath("$.total").value(1))
    }

    @Test
    fun `rejects the company list with no token`() {
        mockMvc
            .perform(get("/api/v1/question-bank/companies"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(service)
    }

    @Test
    fun `rejects the question list with no token`() {
        mockMvc
            .perform(get("/api/v1/question-bank").param("company", "amazon"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(service)
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
                .claim("email", "candidate@example.com")
        }
}
