package com.interviewos.api.arena

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.ObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Exercises the authored campaign seed and system-map mapping against migrated PostgreSQL. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ScenarioArenaRepositoryDatabaseIntegrationTest {
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = ScenarioArenaRepository(jdbc, ObjectMapper())

    @Test
    fun `campaign seed stores ordered steps and a system map`() {
        val candidates = repository.scenarios("system-design")
        assertTrue(candidates.any { it.id == "system-design:fest-night" && it.status == "live" })
        assertTrue(candidates.any { it.id == "system-design:result-day" && it.status == "draft" })

        val first = assertNotNull(repository.firstStep("system-design:fest-night"))
        assertEquals(1, first.position)
        assertEquals(listOf("students", "web", "db"), first.systemState?.nodes)
        assertEquals(listOf("students", "web"), first.systemState?.links?.first())
        assertEquals(2, repository.nextStep(first)?.position)
    }

    @Test
    fun `weak concept names exclude draft-only campaigns`() {
        val names = repository.conceptNames("system-design").map { it.second }
        assertTrue("Database Indexes" in names)
        assertFalse("Data residency" in names)
    }
}
