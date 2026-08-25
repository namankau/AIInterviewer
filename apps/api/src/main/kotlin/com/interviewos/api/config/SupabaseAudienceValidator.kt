package com.interviewos.api.config

import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2ErrorCodes
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt

/**
 * Supabase issues tokens for several audiences from the same signing key. Only tokens
 * minted for a signed-in end user — audience `authenticated` — may reach this API.
 */
class SupabaseAudienceValidator(
    private val audience: String,
) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult =
        if (audience in token.audience.orEmpty()) {
            OAuth2TokenValidatorResult.success()
        } else {
            OAuth2TokenValidatorResult.failure(
                OAuth2Error(
                    OAuth2ErrorCodes.INVALID_TOKEN,
                    "The required audience '$audience' is missing.",
                    null,
                ),
            )
        }
}
