package com.interviewos.api.interview

import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.Test
import org.mockito.Answers
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TerminalMediaCleanupTest {
    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `terminal transition queues an owner-scoped prefix purge and clears media paths atomically`() {
        val client = mock(JdbcClient::class.java)
        val statement = mock(JdbcClient.StatementSpec::class.java, Answers.RETURNS_SELF)

        @Suppress("UNCHECKED_CAST")
        val mapped = mock(JdbcClient.MappedQuerySpec::class.java) as JdbcClient.MappedQuerySpec<Int>
        given(client.sql(anyString())).willReturn(statement)
        given(statement.query(org.mockito.ArgumentMatchers.any<RowMapper<Int>>())).willReturn(mapped)
        given(mapped.single()).willReturn(1)

        val repository = SessionRepository(client, StorageProperties(mediaBucket = "private-media"))
        assertTrue(repository.markSessionStatus(sessionId, userId, "completed"))

        val sql =
            mockingDetails(client)
                .invocations
                .single { it.method.name == "sql" }
                .arguments[0] as String
        val bindings =
            mockingDetails(statement)
                .invocations
                .filter { it.method.name == "param" }
                .associate { it.arguments[0] as String to it.arguments[1] }

        assertContains(sql, "where id = :id and user_id = :u and status = 'in_progress'")
        assertContains(sql, "from transitioned")
        assertContains(sql, "'round_finished'")
        assertContains(sql, "question_audio_path = null")
        assertContains(sql, "answer_audio_path = null")
        assertContains(sql, "answer_video_path = null")
        assertEquals(userId, bindings["u"])
        assertEquals(sessionId, bindings["id"])
        assertEquals("private-media", bindings["bucket"])
        assertEquals("$userId/$sessionId", bindings["prefix"])
    }

    @Test
    fun `transition with no owned in-progress round does not report success`() {
        val client = mock(JdbcClient::class.java)
        val statement = mock(JdbcClient.StatementSpec::class.java, Answers.RETURNS_SELF)

        @Suppress("UNCHECKED_CAST")
        val mapped = mock(JdbcClient.MappedQuerySpec::class.java) as JdbcClient.MappedQuerySpec<Int>
        given(client.sql(anyString())).willReturn(statement)
        given(statement.query(org.mockito.ArgumentMatchers.any<RowMapper<Int>>())).willReturn(mapped)
        given(mapped.single()).willReturn(0)

        assertFalse(SessionRepository(client, StorageProperties()).markSessionStatus(sessionId, userId, "failed"))
    }
}
