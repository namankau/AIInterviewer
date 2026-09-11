package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * A round used to end by the screen changing — no goodbye, and no way for the candidate
 * to tell a finished interview from a crashed one. These pin the two things the last
 * line has to do and the one thing it must not.
 */
class ClosingRemarkTest {
    @Test
    fun `says the round is over and that feedback is coming`() {
        for (ranOutOfTime in listOf(true, false)) {
            val remark = ClosingRemark.forRound(ranOutOfTime)

            assertTrue(remark.contains("feedback"), "the candidate is told what happens next: $remark")
            assertTrue(remark.isNotBlank())
        }
    }

    /**
     * A candidate cut off mid-thought knows they were. Reading them the same line as
     * somebody who finished reads as not having noticed.
     */
    @Test
    fun `tells being stopped by the clock apart from being finished`() {
        assertNotEquals(ClosingRemark.forRound(ranOutOfTime = true), ClosingRemark.forRound(ranOutOfTime = false))
        assertTrue(ClosingRemark.forRound(ranOutOfTime = true).contains("out of time"))
    }

    /**
     * The closing must not say how it went. That is the report's job, on evidence — and a
     * warm sign-off is exactly how a candidate talks themselves into an expectation that
     * a report calibrated to give an ordinary round 40% then has to take away.
     */
    @Test
    fun `passes no judgement on the round`() {
        val praise = listOf("great", "well done", "good job", "excellent", "impressive", "strong", "nailed")

        val remarks =
            listOf(
                ClosingRemark.forRound(ranOutOfTime = true),
                ClosingRemark.forRound(ranOutOfTime = false),
                ClosingRemark.forRound(ranOutOfTime = false, endedByCandidate = true),
            )
        for (remark in remarks.map { it.lowercase() }) {
            for (word in praise) {
                assertTrue(!remark.contains(word), "the closing must not grade the round, but said '$word': $remark")
            }
        }
    }

    /**
     * A candidate who pressed Submit ended the round themselves. The goodbye acknowledges
     * that, rather than claiming the interviewer decided it was done or that time ran out.
     */
    @Test
    fun `acknowledges a round the candidate chose to end`() {
        val remark = ClosingRemark.forRound(ranOutOfTime = false, endedByCandidate = true)

        assertTrue(remark.contains("stop there"), remark)
        assertTrue(!remark.contains("out of time"), "they were not cut off: $remark")
        assertTrue(!remark.contains("everything I wanted"), "it was their decision, not the interviewer's: $remark")
    }
}
