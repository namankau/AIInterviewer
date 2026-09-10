package com.interviewos.api.interview

import com.interviewos.api.resume.ResumeUse
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Every round needs somewhere to go that is not deeper into the last answer.
 *
 * The complaint that produced this: "most questions are asked from the project only and
 * the interviewer isn't moving away". The interviewer had nowhere else to go — the CV was
 * the only material it had been given — so it asked about the project five times.
 */
class RoundTypeTest {
    @Test
    fun `every round has ground to cover`() {
        for (round in RoundType.entries) {
            assertTrue(round.covers.size >= 4, "${round.dbValue} needs enough ground to fill a round, had ${round.covers.size}")
            assertTrue(round.covers.all { it.isNotBlank() })
            assertEquals(round.covers.distinct().size, round.covers.size, "${round.dbValue} repeats itself")
        }
    }

    /**
     * The distinction the fix turns on. A deep-dive is *about* the CV; a design or coding
     * round has its own material on screen and the CV is only context for pitching it.
     */
    @Test
    fun `only the rounds that are about the candidate's own work treat the CV as the subject`() {
        assertEquals(ResumeUse.SYLLABUS, RoundType.PROJECT_DEEP_DIVE.resumeUse)

        assertEquals(ResumeUse.CONTEXT, RoundType.SYSTEM_DESIGN.resumeUse)
        assertEquals(ResumeUse.CONTEXT, RoundType.CODING_PRACTICAL.resumeUse)
        assertEquals(ResumeUse.CONTEXT, RoundType.TECHNICAL_FUNDAMENTALS.resumeUse)
    }

    /** Exactly one round may treat the CV as its syllabus. Two would be the old bug back. */
    @Test
    fun `the CV is the subject of one round only`() {
        val syllabus = RoundType.entries.filter { it.resumeUse == ResumeUse.SYLLABUS }

        assertEquals(listOf(RoundType.PROJECT_DEEP_DIVE), syllabus)
    }

    /**
     * A round whose material is on the candidate's screen must not list the CV as ground
     * to cover — that would reintroduce the drift through the back door.
     */
    @Test
    fun `a round with its own material does not send the interviewer back to the resume`() {
        for (round in listOf(RoundType.SYSTEM_DESIGN, RoundType.CODING_PRACTICAL)) {
            val ground = round.covers.joinToString(" ").lowercase()

            assertTrue(!ground.contains("resume"), "${round.dbValue} points at the CV: $ground")
            assertTrue(!ground.contains("their project"), "${round.dbValue} points at their projects: $ground")
        }
    }
}
