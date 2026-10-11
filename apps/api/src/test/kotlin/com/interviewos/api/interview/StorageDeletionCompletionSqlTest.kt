package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.Answers
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.springframework.jdbc.core.simple.JdbcClient
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StorageDeletionCompletionSqlTest {
    private val jobId = UUID.fromString("78384af7-6042-45b3-a9fd-f2bf592d8e93")
    private val now = Instant.parse("2026-10-11T08:00:00Z")

    @Test
    fun `a settled purge binds the completion timestamp directly`() {
        val harness = repositoryHarness()

        assertTrue(harness.repository.markStorageDeletionSucceeded(jobId, now, settled = true))

        val update = harness.executedSql().lowercase()
        val assignments = update.substringBefore("where")
        val bindings = harness.bindings()

        assertContains(assignments, "completed_at = :now")
        assertFalse(assignments.contains("next_attempt_at"))
        assertFalse(update.contains("case when"))
        assertEquals(Timestamp.from(now), bindings["now"])
        assertEquals(jobId, bindings["id"])
        assertFalse(bindings.containsKey("settled"))
    }

    @Test
    fun `an early purge schedules the final sweep without completing the job`() {
        val harness = repositoryHarness()

        assertTrue(harness.repository.markStorageDeletionSucceeded(jobId, now, settled = false))

        val update = harness.executedSql().lowercase()
        val assignments = update.substringBefore("where")
        val bindings = harness.bindings()

        assertContains(assignments, "next_attempt_at = settle_after")
        assertFalse(assignments.contains("completed_at"))
        assertFalse(update.contains("case when"))
        assertEquals(Timestamp.from(now), bindings["now"])
        assertEquals(jobId, bindings["id"])
        assertFalse(bindings.containsKey("settled"))
    }

    private fun repositoryHarness(): RepositoryHarness {
        val client = mock(JdbcClient::class.java)
        val statement = mock(JdbcClient.StatementSpec::class.java, Answers.RETURNS_SELF)
        given(client.sql(anyString())).willReturn(statement)
        given(statement.update()).willReturn(1)
        return RepositoryHarness(SessionRepository(client), client, statement)
    }

    private data class RepositoryHarness(
        val repository: SessionRepository,
        val client: JdbcClient,
        val statement: JdbcClient.StatementSpec,
    ) {
        fun executedSql(): String =
            mockingDetails(client)
                .invocations
                .single { it.method.name == "sql" }
                .arguments[0] as String

        fun bindings(): Map<String, Any?> =
            mockingDetails(statement)
                .invocations
                .filter { it.method.name == "param" }
                .associate { it.arguments[0] as String to it.arguments[1] }
    }
}
