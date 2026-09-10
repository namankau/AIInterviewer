package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import kotlin.test.assertEquals

class RetentionPropertiesTest {
    private val defaults = RetentionProperties()

    @Test
    fun `keeps a report for four weeks by default`() {
        assertEquals(28, defaults.days)
        assertEquals(Duration.ofDays(28), defaults.reportsKeptFor)
    }

    /**
     * The date a candidate is shown, and the date the sweep works to, have to be the same
     * arithmetic on the same instant — otherwise a report disappears a day before or after
     * the page said it would, and the page was the promise.
     */
    @Test
    fun `expiry and cutoff are the same window seen from opposite ends`() {
        val roundEnded = Instant.parse("2026-09-08T18:30:00Z")
        val expiresAt = defaults.expiresAt(roundEnded)

        assertEquals(Instant.parse("2026-10-06T18:30:00Z"), expiresAt)
        assertEquals(roundEnded, defaults.cutoffAt(expiresAt))
    }

    /**
     * A round is due the moment it is older than the window, and not a moment before. The
     * sweep's predicate is a strict `<`, so a round sitting exactly on the cutoff survives
     * one more pass — which is the right way round for a deletion that cannot be undone.
     */
    @Test
    fun `a round on the cutoff has not expired yet`() {
        val now = Instant.parse("2026-10-06T18:30:00Z")
        val cutoff = defaults.cutoffAt(now)
        val roundEnded = Instant.parse("2026-09-08T18:30:00Z")

        assertEquals(cutoff, roundEnded)
        assertEquals(false, roundEnded.isBefore(cutoff))
    }

    @Test
    fun `the window is one property, and everything follows it`() {
        val ninetyDays = RetentionProperties(reportsKeptFor = Duration.ofDays(90))

        assertEquals(90, ninetyDays.days)
        assertEquals(
            Instant.parse("2026-12-07T18:30:00Z"),
            ninetyDays.expiresAt(Instant.parse("2026-09-08T18:30:00Z")),
        )
    }
}
