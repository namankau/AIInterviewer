package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EntitlementTest {
    @Test
    fun `a new candidate gets one free interview`() {
        val decision = Entitlement.evaluate(completedSessions = 0, paidSessionCredits = 0, sessionInProgress = false)

        assertTrue(decision.allowed)
        assertEquals(1, decision.remainingFree)
    }

    @Test
    fun `the free interview is used up once one is completed`() {
        val decision = Entitlement.evaluate(completedSessions = 1, paidSessionCredits = 0, sessionInProgress = false)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
        assertEquals(0, decision.remainingFree)
    }

    @Test
    fun `an abandoned interview does not consume the free one`() {
        // Abandoned sessions never reach `completed`, so they are not counted. The
        // candidate never saw a report, which is the thing the free tier exists to show.
        val decision = Entitlement.evaluate(completedSessions = 0, paidSessionCredits = 0, sessionInProgress = false)

        assertTrue(decision.allowed)
    }

    @Test
    fun `a paid credit buys another interview`() {
        val decision = Entitlement.evaluate(completedSessions = 1, paidSessionCredits = 1, sessionInProgress = false)

        assertTrue(decision.allowed)
    }

    @Test
    fun `paid credits are consumed in turn`() {
        assertTrue(Entitlement.evaluate(completedSessions = 2, paidSessionCredits = 2, sessionInProgress = false).allowed)
        assertFalse(Entitlement.evaluate(completedSessions = 3, paidSessionCredits = 2, sessionInProgress = false).allowed)
    }

    @Test
    fun `only one interview may run at a time`() {
        val decision = Entitlement.evaluate(completedSessions = 0, paidSessionCredits = 0, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `an in-progress session blocks even a paying candidate`() {
        val decision = Entitlement.evaluate(completedSessions = 1, paidSessionCredits = 5, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `remaining free never goes negative`() {
        val decision = Entitlement.evaluate(completedSessions = 9, paidSessionCredits = 0, sessionInProgress = false)

        assertEquals(0, decision.remainingFree)
    }
}
