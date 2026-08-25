package com.interviewos.api.config

import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SupabaseAudienceValidatorTest {
    private val validator = SupabaseAudienceValidator("authenticated")

    @Test
    fun `accepts a token minted for a signed-in end user`() {
        assertFalse(validator.validate(token(audience = listOf("authenticated"))).hasErrors())
    }

    @Test
    fun `rejects a token minted for another audience`() {
        assertTrue(validator.validate(token(audience = listOf("service_role"))).hasErrors())
    }

    @Test
    fun `rejects a token with no audience at all`() {
        assertTrue(validator.validate(token(audience = null)).hasErrors())
    }

    private fun token(audience: List<String>?): Jwt =
        Jwt
            .withTokenValue("token")
            .header("alg", "ES256")
            .subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
            .issuedAt(Instant.parse("2026-08-25T10:00:00Z"))
            .expiresAt(Instant.parse("2026-08-25T11:00:00Z"))
            .also { builder -> audience?.let { builder.audience(it) } }
            .build()
}
