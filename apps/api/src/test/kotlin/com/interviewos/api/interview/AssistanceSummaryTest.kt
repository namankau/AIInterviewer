package com.interviewos.api.interview

import com.interviewos.api.ai.Intervention
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AssistanceSummaryTest {
    @Test
    fun `counts an unaided round as unaided`() {
        val summary = AssistanceSummary.of(listOf(answered(0), answered(1), answered(2)))

        assertEquals(3, summary.totalAnswers)
        assertEquals(3, summary.unaidedAnswers)
        assertEquals(0, summary.assistedAnswers)
        assertEquals(1.0, summary.creditedRatio)
        assertEquals("Answered all 3 questions unaided.", summary.headline)
    }

    @Test
    fun `separates answers that needed help from those that did not`() {
        val summary =
            AssistanceSummary.of(
                listOf(
                    answered(0),
                    answered(1, Intervention.HINTED, "pointed them at consumer failure"),
                    answered(2, Intervention.GUIDED, "gave them the term idempotency"),
                ),
            )

        assertEquals(1, summary.unaidedAnswers)
        assertEquals(2, summary.assistedAnswers)
        assertEquals("Answered 1 of 3 unaided; needed help on 2.", summary.headline)
    }

    @Test
    fun `weights being led more heavily than being nudged`() {
        val nudged = AssistanceSummary.of(listOf(answered(0, Intervention.HINTED)))
        val led = AssistanceSummary.of(listOf(answered(0, Intervention.GUIDED)))

        // Both needed help, but not the same amount of it. A single unaided ratio would
        // report these identically, which is the thing this exists to avoid.
        assertEquals(nudged.unaidedRatio, led.unaidedRatio)
        assertTrue(led.creditedRatio < nudged.creditedRatio)
    }

    @Test
    fun `ignores turns the candidate never answered`() {
        // The last question asked when a round ends has no answer against it.
        val summary = AssistanceSummary.of(listOf(answered(0), unanswered(1)))

        assertEquals(1, summary.totalAnswers)
    }

    @Test
    fun `handles a round with no answers at all`() {
        val summary = AssistanceSummary.of(listOf(unanswered(0)))

        assertEquals(0, summary.totalAnswers)
        assertEquals(0.0, summary.unaidedRatio)
        assertEquals(0.0, summary.creditedRatio)
        assertEquals("No answers to assess.", summary.headline)
    }

    @Test
    fun `says plainly when every answer needed help`() {
        val summary = AssistanceSummary.of(listOf(answered(0, Intervention.GUIDED), answered(1, Intervention.HINTED)))

        assertEquals("Needed help on every one of the 2 questions.", summary.headline)
    }

    @Test
    fun `carries the notes forward so the report can quote what was given`() {
        val summary =
            AssistanceSummary.of(listOf(answered(0, Intervention.REDIRECTED, "cut in after ninety seconds")))

        assertEquals(listOf("cut in after ninety seconds"), summary.notes)
        assertTrue(summary.promptContext().contains("cut in after ninety seconds"))
    }

    @Test
    fun `treats an unrecognised intervention value as no help rather than guessing`() {
        val row = answered(0).copy(intervention = "something_new")

        assertEquals(1, AssistanceSummary.of(listOf(row)).unaidedAnswers)
    }

    private fun answered(
        index: Int,
        intervention: Intervention = Intervention.NONE,
        note: String? = null,
    ) = TurnRow(
        turnIndex = index,
        questionText = "Question $index",
        questionAudioPath = null,
        answerTranscript = "Answer $index",
        answeredAt = Instant.parse("2026-08-26T10:00:00Z"),
        intervention = intervention.wireValue,
        interventionNote = note,
    )

    private fun unanswered(index: Int) =
        TurnRow(
            turnIndex = index,
            questionText = "Question $index",
            questionAudioPath = null,
            answerTranscript = null,
            answeredAt = null,
        )
}
