package com.interviewos.api.sources

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
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
) {
    private val normalised: Set<String> = emails.map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }.toSet()

    fun allows(email: String?): Boolean {
        val candidate = email?.trim()?.lowercase(Locale.ROOT) ?: return false
        return candidate.isNotEmpty() && candidate in normalised
    }
}

@Component
class AdminAccess(
    private val properties: AdminProperties,
) {
    /**
     * Returns the caller if they may curate sources, and 404s if not.
     *
     * Deliberately not a 403: a 403 confirms the endpoint exists and that the caller is
     * simply not on the list, which tells an unauthorised caller more than they need.
     */
    fun require(identity: SupabaseIdentity): SupabaseIdentity {
        if (!properties.allows(identity.email)) {
            throw ApiException.notFound()
        }
        return identity
    }
}
