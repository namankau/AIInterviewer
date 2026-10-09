package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAnnotation
import com.interviewos.api.ai.CommunicationAnalysis
import com.interviewos.api.ai.CompetencyScore
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.OutcomeSimulation
import com.interviewos.api.ai.ReportContent
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ReportScoreCalibrationTest {
    @Test
    fun `an unaided answer keeps the evidence score unchanged`() {
        val adjusted = ReportScoreCalibration.adjust(report(score = 4), listOf(turn(Intervention.NONE)))

        assertEquals(4, adjusted.competencies.single().score)
        assertEquals("Grounded rationale.", adjusted.competencies.single().rationale)
    }

    @Test
    fun `asking for a nudge deterministically lowers the score`() {
        val hinted =
            turn(Intervention.NONE).copy(
                hintRequestedAt = Instant.parse("2026-10-09T10:00:00Z"),
                hintText = "Think about the failure boundary.",
                hintLevel = Intervention.HINTED.wireValue,
            )

        val adjusted = ReportScoreCalibration.adjust(report(score = 4), listOf(hinted)).competencies.single()

        assertEquals(3, adjusted.score)
        assertTrue(adjusted.rationale.startsWith("Adjusted down because this evidence came after the candidate needed a nudge."))
    }

    @Test
    fun `being led costs more than a nudge and never creates a zero`() {
        val guided =
            ReportScoreCalibration
                .adjust(report(score = 4), listOf(turn(Intervention.GUIDED)))
                .competencies
                .single()
                .score
        val corrected =
            ReportScoreCalibration
                .adjust(report(score = 1), listOf(turn(Intervention.CORRECTED)))
                .competencies
                .single()
                .score

        assertEquals(2, guided)
        assertEquals(1, corrected)
    }

    private fun report(score: Int) =
        ReportContent(
            headline = "Headline",
            summary = "Summary",
            competencies =
                listOf(
                    CompetencyScore(
                        competency = "System design",
                        score = score,
                        maxScore = 5,
                        rationale = "Grounded rationale.",
                        evidenceQuote = "Candidate evidence",
                        turnIndex = 2,
                    ),
                ),
            annotations =
                listOf(
                    AnswerAnnotation(2, "Question", null, null, null, "Stronger framing"),
                ),
            communication = CommunicationAnalysis("Structure", "Fillers", "Pace", "Rambling", "Uncertainty"),
            practicePlan = emptyList(),
            recommendedNextSession = "Next",
            outcomeSimulation = OutcomeSimulation("Simulation", "Limited", "Reasoning"),
        )

    private fun turn(intervention: Intervention) =
        TurnRow(
            turnIndex = 2,
            questionText = "Question",
            questionAudioPath = null,
            answerTranscript = "Candidate evidence",
            answeredAt = Instant.parse("2026-10-09T10:01:00Z"),
            intervention = intervention.wireValue,
        )
}
