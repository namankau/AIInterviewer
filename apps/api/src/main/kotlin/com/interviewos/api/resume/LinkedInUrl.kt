package com.interviewos.api.resume

import java.net.URI

/**
 * A LinkedIn profile URL, or nothing.
 *
 * Two callers with the same requirement. The candidate can type one into their profile,
 * and the resume parser now reads one off the contact line at the top of the document —
 * which is where it almost always is, and why asking them to type it in as well was
 * asking for something they had already given us.
 *
 * Both go through here, because the parser is a language model reading a PDF and will
 * cheerfully return `linkedin.com/in/priya`, `LinkedIn`, `www.linkedin.com/in/priya/`, or
 * the candidate's personal site. The field is shown back to them as their own, and a
 * mis-read URL is worse than an empty one: an empty box is obviously unfilled, a wrong one
 * looks deliberate.
 */
object LinkedInUrl {
    /** [raw] as a storable URL, or null if it is not a LinkedIn profile. */
    fun parse(raw: String?): String? {
        val trimmed = raw?.trim()?.trimEnd('/', ',', ';') ?: return null
        if (trimmed.isEmpty()) return null

        // Resumes print these without a scheme far more often than with one.
        val candidate = if (trimmed.contains("://")) trimmed else "https://$trimmed"
        val host =
            try {
                URI(candidate).host?.lowercase()
            } catch (e: Exception) {
                return null
            } ?: return null

        if (!isLinkedIn(host)) return null
        // A bare host is the site, not a person. Only a profile is worth storing.
        val path = runCatching { URI(candidate).path }.getOrNull().orEmpty()
        if (path.trim('/').isEmpty()) return null
        return candidate
    }

    fun isLinkedIn(host: String): Boolean = host == LINKEDIN || host.endsWith(".$LINKEDIN")

    private const val LINKEDIN = "linkedin.com"
}
