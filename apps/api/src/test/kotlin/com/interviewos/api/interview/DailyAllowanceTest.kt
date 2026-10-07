package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The daily free allowance: 2 rounds and 60 planned minutes a day (owner, 7 Oct 2026).
 * It bounds the model bill while there is no paid tier.
 */
class DailyAllowanceTest {
    private fun today(
        rounds: Int,
        minutes: Int,
    ) = DailyUsage(roundsUsed = rounds, minutesUsed = minutes, roundLimit = 2, minuteLimit = 60)

    private fun evaluate(
        daily: DailyUsage,
        requestedMinutes: Int? = null,
        sessionInProgress: Boolean = false,
    ) = Entitlement.evaluate(
        completedSessions = 5,
        paidSessionCredits = 0,
        sessionInProgress = sessionInProgress,
        freeRounds = null,
        daily = daily,
        requestedMinutes = requestedMinutes,
    )

    @Test
    fun `a fresh day admits a round and says what is left`() {
        val decision = evaluate(today(rounds = 0, minutes = 0), requestedMinutes = 40)

        assertTrue(decision.allowed)
        assertEquals(2, decision.daily.remainingRounds)
        assertEquals(60, decision.daily.remainingMinutes)
        assertEquals("Free practice today: 2 rounds and 60 minutes left.", decision.message)
    }

    @Test
    fun `a third round in a day is refused, however short`() {
        val decision = evaluate(today(rounds = 2, minutes = 10), requestedMinutes = 5)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.DAILY_ROUNDS_REACHED, decision.reason)
        assertTrue(decision.message.contains("Pro"))
        assertTrue(decision.message.contains("resets at midnight"))
    }

    @Test
    fun `sixty minutes used ends the day even with a round to spare`() {
        val decision = evaluate(today(rounds = 1, minutes = 60))

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.DAILY_MINUTES_REACHED, decision.reason)
        assertEquals(1, decision.daily.remainingRounds)
        assertEquals(0, decision.daily.remainingMinutes)
    }

    /** 40 used, 20 left: a 30-minute round does not fit, a 20-minute one does. */
    @Test
    fun `a round longer than the minutes left is refused with the number that would fit`() {
        val tooLong = evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 30)
        assertFalse(tooLong.allowed)
        assertEquals(Entitlement.Reason.DAILY_MINUTES_SHORT, tooLong.reason)
        assertTrue(tooLong.message.contains("20 minutes"))

        assertTrue(evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 20).allowed)
    }

    @Test
    fun `asking only whether a round could start ignores length while minutes remain`() {
        assertTrue(evaluate(today(rounds = 1, minutes = 55)).allowed)
    }

    @Test
    fun `an open round is still the first thing said`() {
        val decision = evaluate(today(rounds = 2, minutes = 60), sessionInProgress = true)

        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `switched off, the allowance counts nothing down`() {
        val decision = evaluate(DailyUsage.UNLIMITED, requestedMinutes = 120)

        assertTrue(decision.allowed)
        assertNull(decision.daily.remainingRounds)
        assertNull(decision.daily.remainingMinutes)
    }
}
