package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAnnotation
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The report's "every answered question gets a note" guarantee does not come from asking
 * the model nicely — it comes from this join. These pin the four things that matter:
 * coverage, correct pairing by position, an honest fallback for a skipped turn, and a note
 * for a turn that does not exist being dropped rather than shown against the wrong question.
 */
class AnswerAnnotationsTest {
    private fun turn(
        turnIndex: Int,
        question: String,
        phase: String = TurnPhase.MAIN.dbValue,
    ) = TurnRow(
        turnIndex = turnIndex,
        questionText = question,
        questionAudioPath = null,
        answerTranscript = "some answer",
        answeredAt = null,
        phase = phase,
    )

    @Test
    fun `every answered non-warm-up turn gets an entry, in order`() {
        val turns =
            listOf(
                turn(0, "Tell me about yourself", phase = TurnPhase.WARMUP.dbValue),
                turn(1, "Design a rate limiter"),
                turn(2, "How would you shard it"),
            )

        val result = AnswerAnnotations.of(turns, modelAnnotations = emptyList())

        assertEquals(2, result.size, "the warm-up turn must not produce a question")
        assertEquals(listOf(1, 2), result.map { it.turnIndex })
        assertEquals(listOf("Design a rate limiter", "How would you shard it"), result.map { it.question })
    }

    @Test
    fun `a model note is joined to the turn at the same position it was given`() {
        val turns = listOf(turn(0, "Design a rate limiter"), turn(1, "How would you shard it"))
        val modelAnnotations =
            listOf(
                AnswerAnnotation(
                    turnIndex = 1,
                    question = "irrelevant — the engine ignores this",
                    worked = "clear on consistent hashing",
                    vague = null,
                    wouldProbe = "hot shard mitigation",
                    strongerFraming = "Lead with the rebalancing cost before naming the scheme.",
                ),
            )

        val result = AnswerAnnotations.of(turns, modelAnnotations)

        assertNull(result[0].worked, "turn 0 got no model note and must not inherit turn 1's")
        assertEquals(AnswerAnnotations.NO_NOTE, result[0].strongerFraming)

        assertEquals("How would you shard it", result[1].question, "question text always comes from the turn")
        assertEquals("clear on consistent hashing", result[1].worked)
        assertEquals("Lead with the rebalancing cost before naming the scheme.", result[1].strongerFraming)
    }

    @Test
    fun `a turn the model skipped still appears, with an honest placeholder`() {
        val turns = listOf(turn(0, "Design a rate limiter"))

        val result = AnswerAnnotations.of(turns, modelAnnotations = emptyList())

        assertEquals(1, result.size)
        assertEquals(AnswerAnnotations.NO_NOTE, result.single().strongerFraming)
    }

    @Test
    fun `a blank stronger-framing note is treated as no note`() {
        val turns = listOf(turn(0, "Design a rate limiter"))
        val modelAnnotations =
            listOf(AnswerAnnotation(turnIndex = 0, question = "x", worked = null, vague = null, wouldProbe = null, strongerFraming = "   "))

        val result = AnswerAnnotations.of(turns, modelAnnotations)

        assertEquals(AnswerAnnotations.NO_NOTE, result.single().strongerFraming)
    }

    @Test
    fun `a note for a turn that does not exist in this round is dropped`() {
        val turns = listOf(turn(0, "Design a rate limiter"))
        val modelAnnotations =
            listOf(
                AnswerAnnotation(
                    turnIndex = 7,
                    question = "a turn that was never asked",
                    worked = "should never surface",
                    vague = null,
                    wouldProbe = null,
                    strongerFraming = "should never surface",
                ),
            )

        val result = AnswerAnnotations.of(turns, modelAnnotations)

        assertEquals(1, result.size, "only the real turn produces an entry")
        assertEquals(AnswerAnnotations.NO_NOTE, result.single().strongerFraming)
    }
}
