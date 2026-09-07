package com.interviewos.api.interview

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * How many interviews this product has run, and how many reports it has produced.
 *
 * Aggregate only, and deliberately so: two integers over every row in the table, with
 * nothing that could identify a candidate or their employer. That is what makes it safe
 * to serve unauthenticated to the landing page.
 *
 * Counted from the rows on every request rather than incremented somewhere. A running
 * total is a number that drifts from the thing it claims to count, and this one is shown
 * to strangers.
 */
@RestController
@RequestMapping("/api/v1")
class UsageController(
    private val repository: SessionRepository,
) {
    @GetMapping("/usage")
    fun usage(): UsageCounts = repository.usageCounts()
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
