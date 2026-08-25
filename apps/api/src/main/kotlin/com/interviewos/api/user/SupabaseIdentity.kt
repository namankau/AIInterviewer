package com.interviewos.api.user

import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException
import java.util.UUID

/**
 * The caller, as asserted by a verified Supabase token. This is the only source of a
 * user id anywhere in the API — a client-supplied id is never trusted.
 */
data class SupabaseIdentity(
    val id: UUID,
    val email: String,
    val displayName: String?,
) {
    companion object {
        /** Google fills `full_name`; other providers vary, so `name` is the fallback. */
        private val DISPLAY_NAME_CLAIMS = listOf("full_name", "name")

        fun from(jwt: Jwt): SupabaseIdentity {
            val id =
                jwt.subject?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                    ?: throw InvalidBearerTokenException("Token subject is not a Supabase user id.")
            val email =
                jwt.getClaimAsString("email")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: throw InvalidBearerTokenException("Token does not carry an email claim.")
            val metadata: Map<String, Any> = jwt.getClaimAsMap("user_metadata").orEmpty()
            val displayName =
                DISPLAY_NAME_CLAIMS
                    .firstNotNullOfOrNull { metadata[it] as? String }
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
            return SupabaseIdentity(id, email, displayName)
        }
    }
}
