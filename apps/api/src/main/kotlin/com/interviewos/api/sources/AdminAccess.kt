package com.interviewos.api.sources

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import java.util.Locale

/**
 * Who may curate the source library.
 *
 * The library decides what the interviewer treats as fact about a named employer, so
 * write access to it is closer to write access to the product than to a user setting.
 * It is therefore an explicit allow-list of email addresses in configuration, not a role
 * column somebody could grant themselves through a bug in a profile endpoint.
 *
 * The address is taken from the verified token, never from the request body. An empty
 * allow-list denies everyone, which is the right default for a list that gates writes:
 * a misconfigured deployment should lock the operator out, not let the internet in.
 */
@ConfigurationProperties(prefix = "interviewos.admin")
data class AdminProperties(
    val emails: List<String> = emptyList(),
    /**
     * Supabase user ids that may administer, when set. An id cannot be claimed by signing
     * up with somebody else's address, so pinning ids is the strongest form of this list.
     */
    val userIds: List<String> = emptyList(),
) {
    private val normalised: Set<String> = emails.map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }.toSet()
    private val pinnedIds: Set<String> = userIds.map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }.toSet()

    /**
     * The email must be on the list, and something other than the email must vouch for the
     * caller: a pinned user id when ids are configured, otherwise a sign-in through a
     * provider that verified the address itself.
     *
     * The email alone is not enough. With email sign-up enabled and confirmation off — one
     * dashboard toggle — anybody could register an admin's address and receive a token
     * carrying it.
     */
    fun allows(identity: SupabaseIdentity): Boolean {
        val candidate = identity.email.trim().lowercase(Locale.ROOT)
        if (candidate.isEmpty() || candidate !in normalised) return false
        return if (pinnedIds.isNotEmpty()) {
            identity.id.toString().lowercase(Locale.ROOT) in pinnedIds
        } else {
            identity.signInProviders.any { it in EMAIL_VERIFYING_PROVIDERS }
        }
    }

    private companion object {
        /** Providers that only hand over an address their user has proved they own. */
        val EMAIL_VERIFYING_PROVIDERS = setOf("google")
    }
}

@Component
class AdminAccess(
    private val properties: AdminProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Returns the caller if they may curate sources, and 404s if not.
     *
     * Deliberately not a 403: a 403 confirms the endpoint exists and that the caller is
     * simply not on the list, which tells an unauthorised caller more than they need.
     */
    fun require(identity: SupabaseIdentity): SupabaseIdentity {
        if (!properties.allows(identity)) {
            // Logged so probing of the admin routes is visible; by account id, never email.
            log
                .atWarn()
                .addKeyValue("user_id", identity.id)
                .log("Refused admin access")
            throw ApiException.notFound()
        }
        return identity
    }
}
