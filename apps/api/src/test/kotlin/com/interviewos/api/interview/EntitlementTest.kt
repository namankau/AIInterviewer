package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EntitlementTest {
    /**
     * How the product is configured today: no allowance, so no gate. The arithmetic for
     * a gate is still tested below, because it is what comes back when there is a paid
     * tier worth gating against — see `interviewos.entitlement.free-rounds`.
     */
    @Test
    fun `with no allowance configured there is no limit`() {
        val tenRoundsIn =
            Entitlement.evaluate(
                completedSessions = 10,
                paidSessionCredits = 0,
                sessionInProgress = false,
                freeRounds = null,
            )

        assertTrue(tenRoundsIn.allowed)
        assertEquals(Entitlement.Reason.ALLOWED, tenRoundsIn.reason)
        // Null rather than zero: there is no allowance to count down, which is not the
        // same as having none left.
        assertNull(tenRoundsIn.remainingFree)
        assertTrue(tenRoundsIn.message.contains("free"))
    }

    @Test
    fun `one interview still runs at a time, even with no limit`() {
        // Not a commercial restriction: two live sessions would race each other's turns.
        val decision =
            Entitlement.evaluate(
                completedSessions = 3,
                paidSessionCredits = 0,
                sessionInProgress = true,
                freeRounds = null,
            )

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `a new candidate gets the configured allowance`() {
        val decision = evaluate(completedSessions = 0)

        assertTrue(decision.allowed)
        assertEquals(1, decision.remainingFree)
    }

    @Test
    fun `the free interview is used up once one is completed`() {
        val decision = evaluate(completedSessions = 1)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
        assertEquals(0, decision.remainingFree)
    }

    @Test
    fun `an abandoned interview does not consume the free one`() {
        // Abandoned sessions never reach `completed`, so they are not counted. The
        // candidate never saw a report, which is the thing the free tier exists to show.
        val decision = evaluate(completedSessions = 0)

        assertTrue(decision.allowed)
    }

    @Test
    fun `a paid credit buys another interview`() {
        val decision = evaluate(completedSessions = 1, paidSessionCredits = 1)

        assertTrue(decision.allowed)
    }

    @Test
    fun `paid credits are consumed in turn`() {
        assertTrue(evaluate(completedSessions = 2, paidSessionCredits = 2).allowed)
        assertFalse(evaluate(completedSessions = 3, paidSessionCredits = 2).allowed)
    }

    @Test
    fun `only one interview may run at a time`() {
        val decision = evaluate(completedSessions = 0, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `an in-progress session blocks even a paying candidate`() {
        val decision = evaluate(completedSessions = 1, paidSessionCredits = 5, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `remaining free never goes negative`() {
        assertEquals(0, evaluate(completedSessions = 9).remainingFree)
    }

    /** The allowance the PRD describes, and what `free-rounds: 1` would restore. */
    private fun evaluate(
        completedSessions: Int,
        paidSessionCredits: Int = 0,
        sessionInProgress: Boolean = false,
    ) = Entitlement.evaluate(
        completedSessions = completedSessions,
        paidSessionCredits = paidSessionCredits,
        sessionInProgress = sessionInProgress,
        freeRounds = 1,
    )
}
