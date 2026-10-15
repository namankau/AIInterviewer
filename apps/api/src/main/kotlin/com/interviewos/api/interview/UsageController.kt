package com.interviewos.api.interview

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * How many interviews this product has run, and how many reports it has produced.
 *
 * Aggregate only, and deliberately so: two integers over every row in the table, with
 * nothing that could identify a candidate or their employer. That is what makes it safe
 * to serve unauthenticated to the landing page.
 *
 * Derived from rows, then cached briefly so unauthenticated bursts do not run two table
 * counts on every request. A running total would drift from what it claims to count.
 */
@RestController
@RequestMapping("/api/v1")
class UsageController internal constructor(
    private val repository: SessionRepository,
    private val clock: Clock,
) {
    @Autowired
    constructor(repository: SessionRepository) : this(repository, Clock.systemUTC())

    private data class Snapshot(
        val value: UsageCounts,
        val expiresAt: Instant,
    )

    @Volatile private var snapshot: Snapshot? = null

    @GetMapping("/usage")
    fun usage(): UsageCounts {
        val now = clock.instant()
        snapshot?.takeIf { it.expiresAt.isAfter(now) }?.let { return it.value }
        return synchronized(this) {
            val refreshedAt = clock.instant()
            snapshot?.takeIf { it.expiresAt.isAfter(refreshedAt) }?.let { return@synchronized it.value }
            repository.usageCounts().also { snapshot = Snapshot(it, clock.instant().plus(CACHE_FOR)) }
        }
    }

    private companion object {
        val CACHE_FOR: Duration = Duration.ofSeconds(60)
    }
}

/**
 * @param interviewsCompleted rounds that reached `completed`. An abandoned session is not
 *   an interview anyone sat, so it is not counted.
 * @param reportsGenerated reports actually composed. Lower than [interviewsCompleted]
 *   when a round finished but nobody opened their report, since reports are built on
 *   first read.
 */
data class UsageCounts(
    val interviewsCompleted: Long,
    val reportsGenerated: Long,
)
