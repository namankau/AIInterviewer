package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class InterviewPlanTest {
    private val startedAt: Instant = Instant.parse("2026-09-04T09:00:00Z")

    private fun planAfter(
        answeredTurns: Int,
        minutesElapsed: Long,
        durationMinutes: Int = 40,
    ) = InterviewPlan.forTurn(
        turnIndex = answeredTurns,
        answeredTurns = answeredTurns,
        startedAt = startedAt,
        durationMinutes = durationMinutes,
        now = startedAt.plus(Duration.ofMinutes(minutesElapsed)),
    )

    @Test
    fun `the round opens on the introduction, never on the round topic`() {
        val opening = InterviewPlan.opening(durationMinutes = 40)

        assertEquals(TurnPhase.WARMUP, opening.phase)
        assertEquals(WarmupFocus.INTRODUCTION, opening.warmupFocus)
        assertFalse(opening.briefTheCandidate)
    }

    /**
     * The regression this class exists for.
     *
     * The warm-up used to end on whichever came first, turns or a share of the clock, and
     * the clock always won: a 20-minute round budgeted it 3 minutes, which one honest
     * answer to "tell me about yourself" spends. Candidates got the introduction and then
     * a system-design question — the exact cold open the warm-up exists to prevent.
     */
    @Test
    fun `a slow talker on a short round still gets a full warm-up`() {
        // Two and a half minutes per answer, which is normal for an introduction.
        val afterIntro = planAfter(answeredTurns = 1, minutesElapsed = 4, durationMinutes = 20)

        assertEquals(TurnPhase.WARMUP, afterIntro.phase)
        assertEquals(WarmupFocus.PROJECT, afterIntro.warmupFocus)
    }

    @Test
    fun `the warm-up runs its beats in order`() {
        assertEquals(WarmupFocus.INTRODUCTION, InterviewPlan.opening(40).warmupFocus)
        assertEquals(WarmupFocus.PROJECT, planAfter(answeredTurns = 1, minutesElapsed = 3).warmupFocus)
        assertEquals(WarmupFocus.STACK_AND_EXPERIENCE, planAfter(answeredTurns = 2, minutesElapsed = 6).warmupFocus)
    }

    @Test
    fun `the round proper starts once the beats are done, and the candidate is briefed first`() {
        val plan = planAfter(answeredTurns = 3, minutesElapsed = 9)

        assertEquals(TurnPhase.MAIN, plan.phase)
        assertNull(plan.warmupFocus)
        assertTrue(plan.briefTheCandidate, "the candidate is told how the round will run exactly once")
    }

    @Test
    fun `the briefing is said once and not repeated`() {
        assertTrue(planAfter(answeredTurns = 3, minutesElapsed = 9).briefTheCandidate)
        assertFalse(planAfter(answeredTurns = 4, minutesElapsed = 12).briefTheCandidate)
    }

    @Test
    fun `a short round gets a shorter warm-up, so the opening stays proportionate`() {
        assertEquals(2, InterviewPlan.warmupTurnsFor(20))
        assertEquals(3, InterviewPlan.warmupTurnsFor(40))

        // Two beats in, a 20-minute round is already into the substance.
        val plan = planAfter(answeredTurns = 2, minutesElapsed = 6, durationMinutes = 20)
        assertEquals(TurnPhase.MAIN, plan.phase)
    }

    @Test
    fun `a runaway warm-up is still cut off by the clock`() {
        // Eight minutes into a 20-minute round on the back of one answer: the ceiling
        // exists so a candidate cannot talk away the whole round before a real question.
        val plan = planAfter(answeredTurns = 1, minutesElapsed = 9, durationMinutes = 20)

        assertEquals(TurnPhase.MAIN, plan.phase)
        assertNull(plan.warmupFocus)
    }

    @Test
    fun `the interviewer wraps up rather than opening new ground near the end`() {
        val plan = planAfter(answeredTurns = 6, minutesElapsed = 37)

        assertEquals(TurnPhase.CLOSING, plan.phase)
        assertFalse(plan.mustConclude)
    }

    @Test
    fun `the clock ends the round`() {
        assertTrue(planAfter(answeredTurns = 7, minutesElapsed = 40).mustConclude)
    }

    @Test
    fun `the turn ceiling ends a round the clock somehow did not`() {
        val plan =
            InterviewPlan.forTurn(
                turnIndex = InterviewPlan.MAX_TURNS,
                answeredTurns = InterviewPlan.MAX_TURNS,
                startedAt = startedAt,
                durationMinutes = 400,
                now = startedAt.plus(Duration.ofMinutes(5)),
            )

        assertTrue(plan.mustConclude, "the ceiling bounds model spend on a pathological session")
    }

    @Test
    fun `warm-up focus carries an instruction the model can act on`() {
        val focus = assertNotNull(planAfter(answeredTurns = 1, minutesElapsed = 3).warmupFocus)

        assertTrue(focus.instruction.isNotBlank())
    }
}
