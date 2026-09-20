package com.interviewos.api.interview

import com.interviewos.api.pool.Level
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Who the round is pitched at (task 048).
 *
 * Two mistakes are possible here and both are expensive. Reading a working engineer as a
 * student asks them about their final-year project; reading a student as an engineer asks
 * them what happened when it broke in production. The second is the one that was actually
 * happening, because `Level.ENTRY` was derived and then almost nothing used it.
 */
class CandidateStageTest {
    @Test
    fun `a fresher role title makes this a campus round even with no resume`() {
        for (title in listOf("Graduate Engineer Trainee", "Software Developer Intern", "Fresher software engineer")) {
            val stage = CandidateStage.of(title, experienceMonths = null)

            assertEquals(Level.ENTRY, stage.level, title)
            assertTrue(stage.campusFresher, title)
        }
    }

    @Test
    fun `a role the candidate typed plainly, with no resume behind it, is not assumed to be a fresher`() {
        val stage = CandidateStage.of("Software Engineer", experienceMonths = null)

        assertEquals(Level.MID, stage.level)
        assertFalse(stage.campusFresher, "guessing 'student' from an empty profile is the same bug in the other direction")
    }

    /**
     * The distinction the whole class turns on. Eighteen months in is entry level and is
     * not campus: they have a job to be interviewed about, and asking them about coursework
     * instead would be the mirror-image failure.
     */
    @Test
    fun `entry level is not the same as a campus fresher`() {
        val firstJob = CandidateStage.of("Software Engineer", experienceMonths = 18)
        val student = CandidateStage.of("Software Engineer", experienceMonths = 0)

        assertEquals(Level.ENTRY, firstJob.level)
        assertFalse(firstJob.campusFresher)
        assertTrue(student.campusFresher)
    }

    @Test
    fun `the role being applied to wins over what the resume works out to`() {
        val stage = CandidateStage.of("Senior Software Engineer", experienceMonths = 0)

        assertEquals(Level.SENIOR, stage.level)
        assertFalse(stage.campusFresher)
    }

    @Test
    fun `a level the candidate stated in words is read the same way as the title`() {
        val stage = CandidateStage.of("Software Engineer", experienceMonths = null, statedLevel = "fresher, 2026 batch")

        assertTrue(stage.campusFresher)
    }

    /**
     * The hole task 051 closes: a plain title with no resume behind it derives mid level
     * (see the test above), but a candidate who says outright that they are a student
     * must be believed over that guess.
     */
    @Test
    fun `a stated student beats a plain title and no resume`() {
        val stage =
            CandidateStage.of("Software Engineer", experienceMonths = null, declaredStage = DeclaredStage.STUDENT)

        assertEquals(Level.ENTRY, stage.level)
        assertTrue(stage.campusFresher)
    }

    @Test
    fun `a stated recent graduate is read the same way as a stated student`() {
        val stage =
            CandidateStage.of("Software Engineer", experienceMonths = null, declaredStage = DeclaredStage.RECENT_GRADUATE)

        assertEquals(Level.ENTRY, stage.level)
        assertTrue(stage.campusFresher)
    }

    /**
     * The other direction: a resume that reads as a fresher's, or none at all, must not
     * override a candidate who says they are already working.
     */
    @Test
    fun `a stated professional is not read as a campus fresher even with a student-looking resume`() {
        val stage =
            CandidateStage.of("Graduate Engineer Trainee", experienceMonths = 0, declaredStage = DeclaredStage.PROFESSIONAL)

        assertFalse(stage.campusFresher, "a stated professional must not be pitched a campus round")
    }

    @Test
    fun `saying nothing reproduces the derivation exactly`() {
        for (title in listOf("Graduate Engineer Trainee", "Software Engineer", "Senior Software Engineer")) {
            for (experience in listOf(null, 0, 18)) {
                assertEquals(
                    CandidateStage.of(title, experience),
                    CandidateStage.of(title, experience, declaredStage = null),
                    "$title / $experience months",
                )
            }
        }
    }

    @Test
    fun `an unrecognised declared stage does not parse`() {
        assertEquals(null, DeclaredStage.parseOrNull("fresher"))
        assertEquals(null, DeclaredStage.parseOrNull(null))
        assertEquals(DeclaredStage.STUDENT, DeclaredStage.parseOrNull("student"))
        assertEquals(DeclaredStage.RECENT_GRADUATE, DeclaredStage.parseOrNull("recent_graduate"))
        assertEquals(DeclaredStage.PROFESSIONAL, DeclaredStage.parseOrNull("professional"))
    }

    @Test
    fun `a fresher is described as one rather than as zero years of experience`() {
        val stage = CandidateStage.of("Graduate Trainee", experienceMonths = 0)

        assertTrue(stage.candidateDescription.contains("no professional work history"))
        assertTrue(stage.targetDescription.contains("campus"))
    }

    /**
     * The five round types whose professional ground asks a student about work they have
     * not done. Each campus list has to be a real round's worth of ground, the same bar
     * `RoundTypeTest` holds the professional lists to.
     */
    @Test
    fun `every calibrated round has a campus version with enough ground to fill a round`() {
        val fresher = CandidateStage(Level.ENTRY, campusFresher = true)

        for (roundType in CampusRounds.CALIBRATED) {
            val covers = fresher.covers(roundType)

            assertTrue(covers.size >= 4, "${roundType.dbValue} needs enough campus ground, had ${covers.size}")
            assertTrue(covers.all { it.isNotBlank() })
            assertEquals(covers.distinct().size, covers.size, "${roundType.dbValue} repeats itself")
            assertTrue(covers != roundType.covers, "${roundType.dbValue} is listed as calibrated but is unchanged")
        }
    }

    /**
     * The specific failure the task names: an interviewer asking somebody who has never
     * shipped what happened when it broke in production. None of those questions may
     * survive into a fresher's round as ground the interviewer is told to cover.
     */
    @Test
    fun `no campus round sends the interviewer after work a student has not done`() {
        val fresher = CandidateStage(Level.ENTRY, campusFresher = true)
        val impossible = listOf("production", "on-call", "on call", "notice period", "stakeholder", "compensation expectations")

        for (roundType in RoundType.entries) {
            val ground = fresher.covers(roundType).joinToString(" ").lowercase()

            for (phrase in impossible) {
                assertTrue(
                    !ground.contains(phrase),
                    "${roundType.dbValue} asks a fresher about '$phrase': $ground",
                )
            }
        }
    }

    @Test
    fun `a professional round keeps its own ground untouched`() {
        val engineer = CandidateStage(Level.SENIOR, campusFresher = false)

        for (roundType in RoundType.entries) {
            assertEquals(roundType.covers, engineer.covers(roundType), roundType.dbValue)
        }
    }

    @Test
    fun `the interviewer is told, in words, not to ask a student about production`() {
        val calibration = CandidateStage(Level.ENTRY, campusFresher = true).interviewerCalibration()

        assertTrue(calibration.contains("Do not ask what happened when it broke in production"))
        assertTrue(calibration.contains("final-year student"))
        assertTrue(calibration.contains("what they personally wrote"))
    }

    /** A fresher's report has a different job: they still have time to study the thing they got wrong. */
    @Test
    fun `the report is told to be instructive for a student and to stay on the evidence`() {
        val calibration = CandidateStage(Level.ENTRY, campusFresher = true).reportCalibration()

        assertTrue(calibration.contains("name the specific thing to study or"))
        assertTrue(calibration.contains("fabricated evidence"))
    }

    /**
     * The first thing a candidate hears. The professional third beat asks what they work
     * in day to day, how big their team is and how much of it they own — a student has
     * none of those, so the round opened by asking them something they cannot answer.
     */
    @Test
    fun `the warm-up asks a student something a student can answer`() {
        val campus = WarmupFocus.STACK_AND_EXPERIENCE.instructionFor(campusFresher = true)

        assertTrue(campus.contains("they have no job"))
        assertTrue(!campus.contains("the size of the team"))
        assertEquals(
            WarmupFocus.STACK_AND_EXPERIENCE.instruction,
            WarmupFocus.STACK_AND_EXPERIENCE.instructionFor(campusFresher = false),
            "somebody with a job is asked the same question as before",
        )
        for (beat in WarmupFocus.entries) {
            assertTrue(beat.campusInstruction.isNotBlank(), "$beat has no campus wording")
            assertTrue(beat.campusInstruction != beat.instruction, "$beat is not actually calibrated")
        }
    }

    @Test
    fun `every level says something about the bar, so no round is left uncalibrated`() {
        for (level in Level.entries) {
            val stage = CandidateStage(level, campusFresher = false)

            assertTrue(stage.interviewerCalibration().length > 40, "$level says nothing useful to the interviewer")
            assertTrue(stage.reportCalibration().length > 40, "$level says nothing useful to the report")
        }
    }
}
