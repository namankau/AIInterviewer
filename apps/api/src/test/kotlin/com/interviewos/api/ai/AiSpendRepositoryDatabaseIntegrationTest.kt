package com.interviewos.api.ai

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

/** Verifies the outcome migration and spend queries against migrated PostgreSQL. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class AiSpendRepositoryDatabaseIntegrationTest {
    private val marker = "ai-spend-test-${UUID.randomUUID()}"
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = AiSpendRepository(jdbc)

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from public.ai_calls where provider = :provider").param("provider", marker).update()
    }

    @Test
    fun `failed estimates and successful fallbacks contribute to daily spend`() {
        val since = Instant.now().minusSeconds(60)
        val spendBefore = repository.spentSince(since)
        val rateBefore = repository.fallbackRateSince(since)
        val usage = AiUsage("gemini-3.1-flash-lite", 100, 20)
        val cost = AiPrices.microUsd(usage)

        repository.record(
            AiCallRecord("composeRound", marker, usage, null, cost, null, null, outcome = "failed", usageEstimated = true),
        )
        repository.record(
            AiCallRecord("composeRound", marker, usage, "first-provider", cost, null, null),
        )

        val rows =
            jdbc
                .sql("select outcome, usage_estimated from public.ai_calls where provider = :provider")
                .param("provider", marker)
                .query { rs, _ -> rs.getString("outcome") to rs.getBoolean("usage_estimated") }
                .list()
        assertEquals(setOf("failed" to true, "succeeded" to false), rows.toSet())
        assertEquals(2, rows.size)
        assertEquals(spendBefore + cost * 2, repository.spentSince(since))
        assertEquals(AiFallbackRate(rateBefore.total + 1, rateBefore.fallbacks + 1), repository.fallbackRateSince(since))
    }
}
