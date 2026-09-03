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

    @Test
    fun `counts help the candidate asked for, not just help they were offered`() {
        // Unaided on the answer itself, but they had to ask to get going.
        val summary = AssistanceSummary.of(listOf(answered(0), askedForHelp(1, Intervention.HINTED)))

        assertEquals(1, summary.unaidedAnswers)
        assertEquals(1, summary.assistedAnswers)
        assertTrue(summary.creditedRatio < 1.0)
    }

    @Test
    fun `credits a turn at whichever help was more generous`() {
        // Asked for a nudge, and was then led through the answer anyway. Crediting the
        // nudge would hide the leading; crediting the leading is the honest read.
        val row = askedForHelp(0, Intervention.HINTED).copy(intervention = Intervention.GUIDED.wireValue)
        val ledOnly = AssistanceSummary.of(listOf(answered(0, Intervention.GUIDED)))

        assertEquals(ledOnly.creditedRatio, AssistanceSummary.of(listOf(row)).creditedRatio)
    }

    @Test
    fun `a hint that shaped the answer is not erased by a mild intervention on it`() {
        // The reverse case: led into it by the hint, then only refocused afterwards.
        val row = askedForHelp(0, Intervention.GUIDED).copy(intervention = Intervention.REDIRECTED.wireValue)

        assertEquals(Intervention.GUIDED.credit, AssistanceSummary.of(listOf(row)).creditedRatio)
    }

    @Test
    fun `marks a note as asked for so the report does not read it as volunteered`() {
        val summary = AssistanceSummary.of(listOf(askedForHelp(0, Intervention.HINTED)))

        assertTrue(summary.notes.single().startsWith("asked for help - "))
        assertTrue(summary.promptContext().contains("asked for help - "))
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

    private fun askedForHelp(
        index: Int,
        level: Intervention,
    ) = answered(index).copy(
        hintRequestedAt = Instant.parse("2026-08-26T09:59:00Z"),
        hintText = "Think about what happens when two writes land in the same second.",
        hintLevel = level.wireValue,
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
