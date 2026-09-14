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
import java.util.UUID

/** `GET /api/v1/prep-plan` -- the ordered practice plan for a company and role. */
@WebMvcTest(PrepPlanController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class PrepPlanControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var service: PrepPlanService

    private val candidate: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `returns the plan for a signed-in candidate`() {
        given(service.plan(candidate, "Amazon", "Backend Engineer", null)).willReturn(samplePlan())

        mockMvc
            .perform(get("/api/v1/prep-plan").param("company", "Amazon").param("role", "Backend Engineer").with(tokenFor(candidate)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].roundType").value("coding_practical"))
            .andExpect(jsonPath("$.items[0].citations").isEmpty())
            .andExpect(jsonPath("$.unsimulatedStages[0].stageName").value("Online assessment"))
    }

    @Test
    fun `rejects a request with no token`() {
        mockMvc
            .perform(get("/api/v1/prep-plan").param("company", "Amazon"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(service)
    }

    private fun samplePlan() =
        PrepPlanView(
            items =
                listOf(
                    PrepPlanItemView(
                        roundType = "coding_practical",
                        roundLabel = "Coding and practical problem solving",
                        stageName = "Onsite coding",
                        why = "Typical of a global product company loop: a \"Onsite coding\" stage.",
                        focusAreas = listOf("approach", "edge cases", "complexity"),
                        suggestedMinutes = 45,
                        citations = emptyList(),
                    ),
                ),
            unsimulatedStages = listOf(PrepPlanUnsimulatedView("Online assessment", "Practise it on a coding platform beforehand.")),
        )

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
