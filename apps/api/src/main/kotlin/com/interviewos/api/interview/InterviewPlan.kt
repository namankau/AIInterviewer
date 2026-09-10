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
 * What the warm-up is asking about on this turn.
 *
 * Real interviews open the same way every time, in the same order, because it works: who
 * are you, what have you built, what do you actually do all day. Leaving that to the
 * model produced a different opening every run and, on a short round, no opening at all.
 * The engine picks the beat; the model only has to say it well.
 */
enum class WarmupFocus(
    /** Handed to the model as the instruction for this turn. */
    val instruction: String,
) {
    INTRODUCTION(
        "Ask them to introduce themselves — background, how long they have been doing this, and what " +
            "they are working on at the moment. This is the opening question of the interview.",
    ),
    PROJECT(
        "Pick something concrete they just mentioned and ask them to walk you through it: what the " +
            "system or project actually did, and what their own part in it was. You are after the shape " +
            "of real work, not an assessment yet. If they mentioned nothing specific, ask for the piece " +
            "of work they are most proud of.",
    ),
    STACK_AND_EXPERIENCE(
        "Ask what they work in day to day — the stack, the kind of problems, the size of the team, how " +
            "much of it they own. This is the last warm-up question, and it is where you find the ground " +
            "the rest of the round will stand on.",
    ),
    ;

    companion object {
        /** The beats in order. The nth warm-up turn gets the nth focus. */
        private val SEQUENCE = listOf(INTRODUCTION, PROJECT, STACK_AND_EXPERIENCE)

        fun forTurn(warmupTurnIndex: Int): WarmupFocus = SEQUENCE.getOrElse(warmupTurnIndex) { SEQUENCE.last() }
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
    /** Which warm-up beat this turn is, or null once the round proper has started. */
    val warmupFocus: WarmupFocus?,
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
 * they built, what they actually work in — and only then gets to the hard part. That
 * warm-up is not padding: it is where the interviewer learns what is worth probing, and
 * it is why an interview feels like a conversation rather than a viva.
 *
 * **The warm-up is counted in exchanges, not minutes.** It used to end on whichever came
 * first, and the clock always won: a 20-minute round allowed the warm-up 3 minutes, which
 * one honest answer to "tell me about yourself" spends. Candidates got the introduction
 * and then a system-design question, which is exactly the cold open the warm-up exists to
 * prevent. The clock is still here, as a ceiling generous enough that only a genuinely
 * runaway answer trips it.
 */
object InterviewPlan {
    /** Exchanges spent warming up before the round proper: introduction, a project, their stack. */
    const val WARMUP_TURNS = 3

    /** A short round gets a shorter warm-up, so the opening stays proportionate to the whole. */
    private const val SHORT_ROUND_MINUTES = 25
    private const val SHORT_ROUND_WARMUP_TURNS = 2

    /**
     * The warm-up's share of the clock, as a backstop only.
     *
     * This is not how the warm-up normally ends — turns are. It exists so a candidate who
     * talks for eight minutes about their degree cannot consume the whole round before a
     * single substantive question is asked.
     */
    private const val WARMUP_CEILING_SHARE = 0.4

    /** Below this many minutes the interviewer starts wrapping up rather than opening new ground. */
    private const val CLOSING_MINUTES = 4

    /**
     * The closing phase, as a share of a very short round.
     *
     * A five-minute round would otherwise be closing from its first minute — four of its
     * five minutes count as "nearly over" — so it would open, warm up, and wrap up
     * without ever asking anything substantive. That makes the shortest round useless for
     * exactly what it is for: checking that a room actually works.
     *
     * Capped at a third, so a short round is a miniature of a real one rather than an
     * opening and an ending with nothing in between. Unchanged at 20 minutes and above,
     * where a third is already wider than the four minutes.
     */
    private fun closingMinutesFor(durationMinutes: Int): Int = minOf(CLOSING_MINUTES, (durationMinutes / 3).coerceAtLeast(1))

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

        val warmupTurns = warmupTurnsFor(durationMinutes)
        val warmupCeiling = (durationMinutes * WARMUP_CEILING_SHARE).toInt().coerceAtLeast(2)

        // Turns are what end the warm-up. The clock only overrides a runaway one.
        val warmingUp = answeredTurns < warmupTurns && elapsed < warmupCeiling
        val justFinishedWarmup = !warmingUp && answeredTurns <= warmupTurns

        val phase =
            when {
                warmingUp -> TurnPhase.WARMUP
                remaining <= closingMinutesFor(durationMinutes) -> TurnPhase.CLOSING
                else -> TurnPhase.MAIN
            }

        return TurnPlan(
            turnIndex = turnIndex,
            phase = phase,
            minutesElapsed = elapsed,
            minutesRemaining = remaining,
            durationMinutes = durationMinutes,
            // `answeredTurns` counts the answers in hand, so it is also the index of the
            // warm-up beat now due: one answer given means the project question is next.
            warmupFocus = if (warmingUp) WarmupFocus.forTurn(answeredTurns) else null,
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
            warmupFocus = WarmupFocus.INTRODUCTION,
            briefTheCandidate = false,
            mustConclude = false,
        )

    fun warmupTurnsFor(durationMinutes: Int): Int = if (durationMinutes < SHORT_ROUND_MINUTES) SHORT_ROUND_WARMUP_TURNS else WARMUP_TURNS

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
