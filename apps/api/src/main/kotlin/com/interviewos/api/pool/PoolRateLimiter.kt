package com.interviewos.api.pool

import java.util.ArrayDeque

/**
 * A ceiling on how fast the generation job may call a model.
 *
 * Not about politeness. Being rate-limited by the provider is the single most expensive
 * thing this job can do to itself: a 429 on the lead model is a failure the chain handles
 * by falling through to the model behind it, which is five to fifteen times the price. A
 * job that hammers the cheap model until it refuses ends up doing its entire run on the
 * expensive one, and the ledger is the only place that would ever say so.
 *
 * A sliding window rather than a token bucket, because the limit being respected is a
 * provider's requests-per-minute, which is itself a window: a bucket that had been idle
 * would let a burst of sixty through in a second and be refused for it.
 *
 * Blocking rather than rejecting. There is nobody waiting on this work, so the right answer
 * to "too fast" is to slow down, not to fail a cell that has nothing wrong with it.
 */
class PoolRateLimiter(
    private val permitsPerMinute: Int,
    private val clock: () -> Long = System::currentTimeMillis,
    private val sleeper: (Long) -> Unit = { Thread.sleep(it) },
) {
    private val window = ArrayDeque<Long>()

    init {
        require(permitsPerMinute > 0) { "A rate limiter with no permits would never run." }
    }

    /** Waits, if it has to, until another call may be made. */
    fun acquire() {
        while (true) {
            val waitFor =
                synchronized(window) {
                    val now = clock()
                    while (window.isNotEmpty() && now - window.peekFirst() >= WINDOW_MILLIS) {
                        window.removeFirst()
                    }
                    if (window.size < permitsPerMinute) {
                        window.addLast(now)
                        return
                    }
                    // How long until the oldest permit in the window expires.
                    (WINDOW_MILLIS - (now - window.peekFirst())).coerceAtLeast(1)
                }
            sleeper(waitFor)
        }
    }

    private companion object {
        const val WINDOW_MILLIS = 60_000L
    }
}
