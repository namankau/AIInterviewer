package com.interviewos.api.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Everything the API needs to verify a Supabase-issued access token, derived from the
 * project URL alone. Verification is against the project's published JWKS, so no JWT
 * secret is shared with this service.
 */
@ConfigurationProperties(prefix = "interviewos.auth")
data class SupabaseAuthProperties(
    val supabaseUrl: String,
    val audience: String = "authenticated",
) {
    private val baseUrl: String get() = supabaseUrl.trimEnd('/')

    /** Value Supabase puts in the `iss` claim. */
    val issuer: String get() = "$baseUrl/auth/v1"

    val jwkSetUri: String get() = "$issuer/.well-known/jwks.json"
}
