package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class InterviewClockServiceTest {
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `room entry not session creation owns the deadline`() {
        val harness = BankRoundHarness()
        val createdAt = Instant.parse("2026-10-09T09:45:00Z")
        val enteredAt = Instant.parse("2026-10-09T10:00:00Z")
        val created = session(createdAt, enteredAt = null)
        val entered = session(createdAt, enteredAt = enteredAt)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(created, entered)

        val view = harness.service.begin(candidate, sessionId)

        assertEquals(enteredAt, view.startedAt)
        assertEquals(enteredAt.plusSeconds(20 * 60), view.scheduledEndAt)
    }

    private fun session(
        createdAt: Instant,
        enteredAt: Instant?,
    ) = SessionRow(
        id = sessionId,
        companyName = "General practice",
        archetype = "global_product",
        archetypeConfidence = "inferred",
        roleTitle = "Role not specified",
        roundType = "technical_fundamentals",
        language = "english",
        status = "in_progress",
        startedAt = createdAt,
        endedAt = null,
        consentVideo = false,
        durationMinutes = 20,
        enteredAt = enteredAt,
    )
}
