package com.interviewos.api.interview

import java.time.Duration
import java.time.Instant

/** Where an exchange sits in the round. Mirrors the `turn_phase` Postgres enum. */
enum class TurnPhase(
    val dbValue: String,
) {
    WARMUP("warmup"),
    MAIN("main"),
    CLOSING("closing"),
    ;

    companion object {
        fun fromDbValue(value: String?): TurnPhase = entries.firstOrNull { it.dbValue == value } ?: MAIN
    }
}

/**
 * What the interviewer should be doing right now.
 *
 * The model is told this; it does not decide it. Where the round is up to, whether the
 * candidate has been told the plan yet, and whether there is time left are all engine
 * decisions — the same rule that keeps question selection and scoring server-side
 * (CLAUDE.md). Left to itself a model will happily open on a system-design question and
 * run until it gets bored.
 */
data class TurnPlan(
    val turnIndex: Int,
    val phase: TurnPhase,
    val minutesElapsed: Int,
    val minutesRemaining: Int,
    val durationMinutes: Int,
    /**
     * True on the one turn where the interviewer sets out how the round will run, before
     * asking the first substantive question. Real interviewers do this and it settles a
     * nervous candidate more than anything else in the first five minutes.
     */
    val briefTheCandidate: Boolean,
    /** The clock or the turn ceiling has run out; this round has to end now. */
    val mustConclude: Boolean,
)

/**
 * The shape of a round.
 *
 * A real interview opens by finding out who is sitting opposite — background, something
 * they built and are proud of, what they actually work in — and only then gets to the
 * hard part. That warm-up is not padding: it is where the interviewer learns what to
 * probe, and it is why an interview feels like a conversation rather than a viva.
 */
object InterviewPlan {
    /** Exchanges spent warming up before the round proper: introduction, a project, their stack. */
    const val WARMUP_TURNS = 3

    /** The warm-up is bounded by the clock too, so a talkative candidate cannot eat the round. */
    private const val WARMUP_SHARE = 0.18

    /** Below this many minutes the interviewer starts wrapping up rather than opening new ground. */
    private const val CLOSING_MINUTES = 4

    /**
     * A ceiling, not a target — the clock ends the round. It exists so a pathological
     * session cannot run up an unbounded model bill.
     */
    const val MAX_TURNS = 16

    fun forTurn(
        turnIndex: Int,
        answeredTurns: Int,
        startedAt: Instant?,
        durationMinutes: Int,
        now: Instant,
    ): TurnPlan {
        val elapsed = minutesBetween(startedAt, now)
        val remaining = (durationMinutes - elapsed).coerceAtLeast(0)
        val warmupMinutes = (durationMinutes * WARMUP_SHARE).toInt().coerceAtLeast(1)

        // Warm-up ends on whichever comes first: enough exchanges, or its share of the clock.
        val warmingUp = answeredTurns < WARMUP_TURNS && elapsed < warmupMinutes
        val justFinishedWarmup = !warmingUp && answeredTurns <= WARMUP_TURNS

        val phase =
            when {
                warmingUp -> TurnPhase.WARMUP
                remaining <= CLOSING_MINUTES -> TurnPhase.CLOSING
                else -> TurnPhase.MAIN
            }

        return TurnPlan(
            turnIndex = turnIndex,
            phase = phase,
            minutesElapsed = elapsed,
            minutesRemaining = remaining,
            durationMinutes = durationMinutes,
            // Said once, on the first turn that is no longer warm-up.
            briefTheCandidate = justFinishedWarmup && phase != TurnPhase.WARMUP,
            mustConclude = remaining <= 0 || answeredTurns >= MAX_TURNS,
        )
    }

    /** The opening turn, before a clock has started or anything has been answered. */
    fun opening(durationMinutes: Int): TurnPlan =
        TurnPlan(
            turnIndex = 0,
            phase = TurnPhase.WARMUP,
            minutesElapsed = 0,
            minutesRemaining = durationMinutes,
            durationMinutes = durationMinutes,
            briefTheCandidate = false,
            mustConclude = false,
        )

    private fun minutesBetween(
        from: Instant?,
        to: Instant,
    ): Int =
        from?.let {
            Duration
                .between(it, to)
                .toMinutes()
                .toInt()
                .coerceAtLeast(0)
        } ?: 0
}
