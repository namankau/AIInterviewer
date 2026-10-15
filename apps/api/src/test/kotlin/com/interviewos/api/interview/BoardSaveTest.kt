package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoMoreInteractions
import org.springframework.http.HttpStatus
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BoardSaveTest {
    private val harness = BankRoundHarness()
    private val userId = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()

    @Test
    fun `saves a board for an in-progress round`() {
        sessionWithStatus("in_progress")
        val board = harness.mapper.readTree("""{"kind":"dsa","sources":{"python":"print(1)"}}""")

        harness.service.saveBoard(userId, sessionId, board)

        verify(harness.repository).setBoard(sessionId, userId, """{"kind":"dsa","sources":{"python":"print(1)"}}""")
    }

    @Test
    fun `rejects a board larger than five mebibytes before updating storage`() {
        sessionWithStatus("in_progress")
        val board = harness.mapper.readTree("""{"kind":"dsa","source":"${"x".repeat(5 * 1024 * 1024)}"}""")

        val error = assertFailsWith<ApiException> { harness.service.saveBoard(userId, sessionId, board) }

        assertEquals(HttpStatus.CONTENT_TOO_LARGE, error.status)
        assertEquals("board_too_large", error.code)
        verify(harness.repository).findSession(sessionId, userId)
        verifyNoMoreInteractions(harness.repository)
    }

    @Test
    fun `rejects a save once the round has ended`() {
        sessionWithStatus("completed")

        val error = assertFailsWith<ApiException> { harness.service.saveBoard(userId, sessionId, harness.mapper.readTree("{}")) }

        assertEquals(HttpStatus.CONFLICT, error.status)
        verify(harness.repository).findSession(sessionId, userId)
        verifyNoMoreInteractions(harness.repository)
    }

    @Test
    fun `detects a round ending between the ownership read and the atomic update`() {
        sessionWithStatus("in_progress")
        given(harness.repository.setBoard(sessionId, userId, "{}")).willReturn(false)

        val error = assertFailsWith<ApiException> { harness.service.saveBoard(userId, sessionId, harness.mapper.readTree("{}")) }

        assertEquals(HttpStatus.CONFLICT, error.status)
    }

    @Test
    fun `does not reveal another candidate's round`() {
        val error = assertFailsWith<ApiException> { harness.service.saveBoard(userId, sessionId, harness.mapper.readTree("{}")) }

        assertEquals(HttpStatus.NOT_FOUND, error.status)
        verify(harness.repository).findSession(sessionId, userId)
        verifyNoMoreInteractions(harness.repository)
    }

    private fun sessionWithStatus(status: String) {
        val session = mock(SessionRow::class.java)
        given(session.status).willReturn(status)
        given(harness.repository.findSession(sessionId, userId)).willReturn(session)
    }
}
