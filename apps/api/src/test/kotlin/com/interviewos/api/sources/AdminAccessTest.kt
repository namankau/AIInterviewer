package com.interviewos.api.sources

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Admin access decides who may change what the interviewer treats as fact about a real
 * employer. An email claim alone must never be enough to get it.
 */
class AdminAccessTest {
    private val adminId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `a listed email signed in with Google is an admin`() {
        val properties = AdminProperties(emails = listOf("Owner@Example.com"))

        assertTrue(properties.allows(identity("owner@example.com", setOf("google"))))
    }

    @Test
    fun `a listed email from an email-and-password sign-up is not`() {
        val properties = AdminProperties(emails = listOf("owner@example.com"))

        assertFalse(properties.allows(identity("owner@example.com", setOf("email"))))
        assertFalse(properties.allows(identity("owner@example.com", emptySet())))
    }

    @Test
    fun `pinned ids decide, whatever the provider`() {
        val properties = AdminProperties(emails = listOf("owner@example.com"), userIds = listOf(adminId.toString()))

        assertTrue(properties.allows(identity("owner@example.com", setOf("email"))))
        assertFalse(properties.allows(identity("owner@example.com", setOf("google"), id = UUID.randomUUID())))
    }

    @Test
    fun `an email not on the list is refused even with a pinned id`() {
        val properties = AdminProperties(emails = listOf("owner@example.com"), userIds = listOf(adminId.toString()))

        assertFalse(properties.allows(identity("someone@example.com", setOf("google"))))
    }

    @Test
    fun `an empty list refuses everyone`() {
        assertFalse(AdminProperties().allows(identity("owner@example.com", setOf("google"))))
    }

    @Test
    fun `refusal is a 404, not a 403`() {
        val access = AdminAccess(AdminProperties(emails = listOf("owner@example.com")))

        val refused = assertFailsWith<ApiException> { access.require(identity("owner@example.com", setOf("email"))) }

        assertEquals(404, refused.status.value())
    }

    /** The providers come from `app_metadata`, which a user cannot write; `user_metadata` is ignored. */
    @Test
    fun `the sign-in provider is read from app_metadata, never user_metadata`() {
        val token =
            Jwt
                .withTokenValue("token")
                .header("alg", "ES256")
                .subject(adminId.toString())
                .claim("email", "owner@example.com")
                .claim("app_metadata", mapOf("provider" to "email", "providers" to listOf("email")))
                .claim("user_metadata", mapOf("email_verified" to true, "provider" to "google"))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build()

        val parsed = SupabaseIdentity.from(token)

        assertEquals(setOf("email"), parsed.signInProviders)
        assertFalse(AdminProperties(emails = listOf("owner@example.com")).allows(parsed))
    }

    private fun identity(
        email: String,
        providers: Set<String>,
        id: UUID = adminId,
    ) = SupabaseIdentity(id, email, null, providers)
}
