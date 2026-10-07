package com.interviewos.api.common

import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class AiRateLimiterTest {
    private class MovableClock(
        var now: Instant,
    ) : Clock() {
        override fun getZone() = ZoneOffset.UTC

        override fun withZone(zone: java.time.ZoneId) = this

        override fun instant() = now
    }

    private val clock = MovableClock(Instant.parse("2026-10-08T10:00:00Z"))
    private val limiter = AiRateLimiter(clock)

    @Test
    fun `allows up to the limit, then says how long to wait`() {
        repeat(3) { assertNull(limiter.acquire("drafts:a", limitPerHour = 3)) }

        clock.now = clock.now.plusSeconds(600)
        val wait = assertNotNull(limiter.acquire("drafts:a", limitPerHour = 3))

        assertEquals(3000, wait)
    }

    @Test
    fun `a new hour starts a new allowance`() {
        repeat(2) { limiter.acquire("drafts:a", limitPerHour = 2) }
        assertNotNull(limiter.acquire("drafts:a", limitPerHour = 2))

        clock.now = clock.now.plusSeconds(3600)

        assertNull(limiter.acquire("drafts:a", limitPerHour = 2))
    }

    @Test
    fun `accounts and limits are counted separately`() {
        limiter.acquire("drafts:a", limitPerHour = 1)

        assertNull(limiter.acquire("drafts:b", limitPerHour = 1))
        assertNull(limiter.acquire("briefs:a", limitPerHour = 1))
        assertNotNull(limiter.acquire("drafts:a", limitPerHour = 1))
    }
}
