package com.interviewos.api.storage

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Supabase Storage access. The service-role key bypasses RLS and must never leave the
 * server; ownership is enforced by the API from the verified token, not by these creds.
 */
@ConfigurationProperties(prefix = "interviewos.storage")
data class StorageProperties(
    val supabaseUrl: String = "",
    val serviceRoleKey: String = "",
    val resumeBucket: String = "resumes",
    val mediaBucket: String = "interview-media",
) {
    val configured: Boolean
        get() = supabaseUrl.isNotBlank() && serviceRoleKey.isNotBlank()

    val restBaseUrl: String
        get() = "${supabaseUrl.trimEnd('/')}/storage/v1"
}
