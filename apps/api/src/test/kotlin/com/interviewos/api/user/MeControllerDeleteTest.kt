package com.interviewos.api.user

import com.interviewos.api.account.AccountDeletion
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * `DELETE /api/v1/me` — the route that destroys a whole account.
 *
 * There is no user id in the path or the body. The test that matters most is the one
 * proving the account handed to the service is the token's subject.
 */
@WebMvcTest(MeController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class MeControllerDeleteTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var userService: UserService

    @MockitoBean
    private lateinit var accountDeletion: AccountDeletion

    private val candidate: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `deletes the caller's own account and returns no content`() {
        mockMvc
            .perform(delete("/api/v1/me").with(tokenFor(candidate)))
            .andExpect(status().isNoContent)

        verify(accountDeletion).delete(candidate)
    }

    @Test
    fun `rejects a delete with no token`() {
        mockMvc
            .perform(delete("/api/v1/me"))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error").value("unauthorized"))

        verifyNoInteractions(accountDeletion)
    }

    @Test
    fun `says so when the sign-in could not be removed`() {
        willThrow(ApiException.upstreamUnavailable("Your data has been deleted, but your sign-in could not be removed just now."))
            .given(accountDeletion)
            .delete(candidate)

        mockMvc
            .perform(delete("/api/v1/me").with(tokenFor(candidate)))
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.error").value("upstream_unavailable"))
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
