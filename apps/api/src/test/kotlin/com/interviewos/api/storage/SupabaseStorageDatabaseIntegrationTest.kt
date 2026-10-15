package com.interviewos.api.storage

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import kotlin.test.assertContentEquals
import kotlin.test.assertFailsWith

/** Real local Storage API coverage for the recursive deletion path; CI starts Supabase first. */
@EnabledIfEnvironmentVariable(named = "TEST_SUPABASE_SERVICE_KEY", matches = ".+")
class SupabaseStorageDatabaseIntegrationTest {
    @Test
    fun `deleting a round prefix removes nested objects while retaining a sibling round`() {
        val storage =
            SupabaseObjectStorage(
                StorageProperties(
                    supabaseUrl = System.getenv("TEST_SUPABASE_URL") ?: "http://127.0.0.1:54321",
                    serviceRoleKey = System.getenv("TEST_SUPABASE_SERVICE_KEY"),
                ),
                JsonMapper.builder().build(),
                RestClient.builder(),
            )
        val account = "integration-${UUID.randomUUID()}"
        val roundPrefix = "$account/round-1"
        val nestedPath = "$roundPrefix/nested/answer.webm"
        val siblingPath = "$account/round-2/answer.webm"
        val payload = byteArrayOf(1, 2, 3, 4)

        try {
            storage.upload("interview-media", nestedPath, payload, "audio/webm")
            storage.upload("interview-media", siblingPath, payload, "audio/webm")
            assertContentEquals(payload, storage.download("interview-media", nestedPath))

            storage.deleteByPrefix("interview-media", roundPrefix)

            assertFailsWith<ObjectStorageException> { storage.download("interview-media", nestedPath) }
            assertContentEquals(payload, storage.download("interview-media", siblingPath))
        } finally {
            storage.deleteByPrefix("interview-media", account)
        }
    }
}
