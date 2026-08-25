package com.interviewos.api.user

import com.interviewos.api.common.ApiErrorWriter
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
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@WebMvcTest(MeController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiSecurityTestConfiguration::class)
class MeControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var userService: UserService

    private val userId: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    private val identity =
        SupabaseIdentity(
            id = userId,
            email = "candidate@example.com",
            displayName = "Test Candidate",
        )

    @Test
    fun `returns the profile for a verified token`() {
        given(userService.loadProfile(identity)).willReturn(profileResponse())

        mockMvc
            .perform(get("/api/v1/me").with(googleSignedInToken()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(userId.toString()))
            .andExpect(jsonPath("$.email").value("candidate@example.com"))
            .andExpect(jsonPath("$.displayName").value("Test Candidate"))
            .andExpect(jsonPath("$.preferredLanguage").value("english"))
            .andExpect(jsonPath("$.profile.function").value("backend_engineering"))
            .andExpect(jsonPath("$.profile.compensationExpectation.currency").value("INR"))
    }

    @Test
    fun `rejects a request with no token`() {
        mockMvc
            .perform(get("/api/v1/me"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error").value("unauthorized"))

        // An unauthenticated caller must never reach provisioning.
        verifyNoInteractions(userService)
    }

    /** Mirrors the claims Supabase issues after a Google sign-in. */
    private fun googleSignedInToken() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
                .claim("user_metadata", mapOf("full_name" to "Test Candidate"))
        }

    private fun profileResponse() =
        MeResponse(
            id = userId,
            email = "candidate@example.com",
            displayName = "Test Candidate",
            preferredLanguage = "english",
            createdAt = Instant.parse("2026-08-25T10:00:00Z"),
            profile =
                ProfileResponse(
                    function = "backend_engineering",
                    currentLevel = "senior",
                    targetLevel = "staff",
                    totalExperienceMonths = 84,
                    peopleManagementScope = null,
                    location = "Bengaluru, India",
                    relocationIntent = "open_internationally",
                    workAuthorisationStatus = "requires_sponsorship",
                    noticePeriodDays = 60,
                    compensationExpectation =
                        CompensationBand(
                            min = BigDecimal("4000000.00"),
                            max = BigDecimal("5000000.00"),
                            currency = "INR",
                        ),
                ),
        )
}
