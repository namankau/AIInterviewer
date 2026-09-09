package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration
import java.time.Instant

/**
 * How long a round's report, transcript and recordings are kept before being cleared.
 *
 * **Four weeks, and the number is not arbitrary.** It is the longest window over which
 * the report is still doing the job it was written for. A candidate reads their report in
 * the day or two after the round, works on what it said, and sits another one; the second
 * round is the thing that tells them whether the first piece of advice landed. Interview
 * processes themselves run on that clock — a screen, then a loop, then a decision, inside
 * about a month — so a report that survives the process it was preparing somebody for has
 * survived long enough. Past that it is a recording of a rehearsal for an interview that
 * has already happened, and the honest thing to do with it is delete it.
 *
 * Four weeks rather than "a month" because a candidate should be able to work out the
 * date themselves without a calendar: a round sat on a Tuesday expires on a Tuesday.
 *
 * The other reason is storage, and it is the reason this ran now: one round is a handful
 * of audio objects per turn, kept in a private bucket for ever, for a report nobody has
 * opened since the week it was written. Retention is what stops the cost of a candidate
 * growing with every round they ever sit.
 *
 * Changing it is one property, and everything downstream follows — including the sentence
 * the dashboard shows candidates, which is fed from [days] rather than written out in the
 * browser:
 *
 * ```yaml
 * interviewos:
 *   retention:
 *     reports-kept-for: 90d
 * ```
 *
 * [batchSize] bounds one pass of the job rather than the total. Each round expired is a
 * transaction and a call to object storage, and a deployment that has been down for a
 * week should catch up over a few passes rather than in one long sweep holding
 * connections open.
 */
@ConfigurationProperties(prefix = "interviewos.retention")
data class RetentionProperties(
    val reportsKeptFor: Duration = Duration.ofDays(28),
    val batchSize: Int = 200,
) {
    /** The retention window in whole days, which is how it is expressed to candidates. */
    val days: Int
        get() = reportsKeptFor.toDays().toInt()

    /** Rounds that ended before this are due to be cleared. */
    fun cutoffAt(now: Instant): Instant = now.minus(reportsKeptFor)

    /**
     * When a round that ended at [endedAt] will be cleared.
     *
     * Measured from the end of the round rather than from when the report happened to be
     * composed. A report is written lazily, the first time somebody opens it, so
     * generation time is really "when the candidate got round to reading it" — and an
     * expiry date that moves depending on when you clicked is one no candidate can
     * predict. The end of the round is a date they already know.
     */
    fun expiresAt(endedAt: Instant): Instant = endedAt.plus(reportsKeptFor)
}
