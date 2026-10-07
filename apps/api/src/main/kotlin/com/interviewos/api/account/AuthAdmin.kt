package com.interviewos.api.account

import com.interviewos.api.storage.StorageProperties
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.util.UUID

/** Removes a sign-in from the identity provider. */
interface AuthAdmin {
    /** False when the server has no admin credentials, so nothing should be attempted. */
    val configured: Boolean

    /** Deletes the user. One that is already gone counts as deleted. */
    fun deleteUser(userId: UUID)
}

class AuthAdminException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/**
 * [AuthAdmin] backed by the Supabase Auth admin API. It uses the same project URL and
 * service-role key as storage, which is the one admin credential this server holds.
 * Boundary code: mocked in tests, never called by one.
 */
@Component
class SupabaseAuthAdmin(
    private val properties: StorageProperties,
    restClientBuilder: RestClient.Builder,
) : AuthAdmin {
    private val restClient = restClientBuilder.build()

    override val configured: Boolean
        get() = properties.configured

    override fun deleteUser(userId: UUID) {
        if (!configured) throw AuthAdminException("Supabase admin credentials are not configured.")
        try {
            restClient
                .delete()
                .uri("${properties.supabaseUrl.trimEnd('/')}/auth/v1/admin/users/$userId")
                .headers { it.setBearerAuth(properties.serviceRoleKey) }
                .header("apikey", properties.serviceRoleKey)
                .retrieve()
                .toBodilessEntity()
        } catch (ex: HttpClientErrorException) {
            // A retry after a partial failure finds the user already removed.
            if (ex.statusCode == HttpStatus.NOT_FOUND) return
            throw AuthAdminException("Failed to delete auth user $userId.", ex)
        } catch (ex: RestClientException) {
            throw AuthAdminException("Failed to delete auth user $userId.", ex)
        }
    }
}
