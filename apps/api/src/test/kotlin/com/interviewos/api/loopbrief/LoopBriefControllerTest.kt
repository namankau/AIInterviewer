package com.interviewos.api.loopbrief

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

/** `GET /api/v1/loop-brief` -- how the company interviews, before the round. */
@WebMvcTest(LoopBriefController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class LoopBriefControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var service: LoopBriefService

    @Test
    fun `returns the brief for a signed-in candidate`() {
        given(service.brief("Amazon", "Backend Engineer", "L5")).willReturn(sampleBrief())

        mockMvc
            .perform(
                get("/api/v1/loop-brief")
                    .param("company", "Amazon")
                    .param("role", "Backend Engineer")
                    .param("level", "L5")
                    .with(candidateToken()),
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.company.name").value("Amazon"))
            .andExpect(jsonPath("$.hasSources").value(true))
            .andExpect(jsonPath("$.sourcedStages[0].stageName").value("Online assessment"))
            .andExpect(jsonPath("$.bankCoverage.bankUrl").value("/questions/amazon"))
    }

    @Test
    fun `rejects a request with no token`() {
        mockMvc
            .perform(get("/api/v1/loop-brief").param("company", "Amazon"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(service)
    }

    private fun candidateToken() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
                .claim("email", "candidate@example.com")
        }

    private fun sampleBrief() =
        LoopBriefView(
            company =
                LoopBriefCompanyView(
                    slug = "amazon",
                    name = "Amazon",
                    archetype = "global_product",
                    archetypeLabel = "Global product company",
                    archetypeInProse = "a global product company loop",
                    archetypeConfidence = "recognised",
                ),
            hasSources = true,
            sourcedStages =
                listOf(
                    LoopBriefSourcedStageView(
                        stageName = "Online assessment",
                        roleFamily = "Backend Engineer",
                        order = 1,
                        format = "Online, 90 minutes",
                        durationMinutes = 90,
                        assesses = "Coding fundamentals",
                        roundType = null,
                        citations =
                            listOf(
                                LoopBriefCitationView(
                                    title = "How we hire: SDE II",
                                    publisher = "Amazon",
                                    url = "https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep",
                                    year = 2024,
                                    origin = "employer",
                                ),
                            ),
                    ),
                ),
            generalPattern =
                listOf(
                    LoopBriefGeneralStageView(
                        order = 1,
                        stageName = "Recruiter screen",
                        format = "Phone, 30 minutes",
                        assesses = "Motivation and basic fit",
                        roundType = null,
                    ),
                ),
            bankCoverage =
                LoopBriefCoverageView(
                    questionCount = 23,
                    roundTypes = listOf(LoopBriefRoundCountView("coding_practical", 23)),
                    bankUrl = "/questions/amazon",
                ),
        )
}
