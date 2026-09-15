package com.interviewos.api.pool

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The rate limiter, on a clock this test controls. Nothing here actually sleeps: a test
 * that waited a real minute to prove a window works would be a test nobody runs.
 */
class PoolRateLimiterTest {
    private var now = 0L
    private val slept = mutableListOf<Long>()

    private fun limiter(permitsPerMinute: Int) =
        PoolRateLimiter(
            permitsPerMinute = permitsPerMinute,
            clock = { now },
            sleeper = { millis ->
                slept += millis
                now += millis
            },
        )

    @Test
    fun `permits within the window go straight through`() {
        val limiter = limiter(3)

        repeat(3) { limiter.acquire() }

        assertThat(slept).isEmpty()
    }

    @Test
    fun `the call past the limit waits for the oldest permit to age out`() {
        val limiter = limiter(2)

        limiter.acquire()
        now += 10_000
        limiter.acquire()
        limiter.acquire()

        // The first permit was taken at t=0, so at t=10,000 there are 50,000ms left of its
        // minute. It waits that out rather than failing the cell: nobody is waiting on this
        // work, and being refused by the provider costs far more than being slow.
        assertThat(slept).containsExactly(50_000)
        assertThat(now).isEqualTo(60_000)
    }

    @Test
    fun `permits are reclaimed once their minute has passed`() {
        val limiter = limiter(1)

        limiter.acquire()
        now += 60_000
        limiter.acquire()

        assertThat(slept).isEmpty()
    }
}
