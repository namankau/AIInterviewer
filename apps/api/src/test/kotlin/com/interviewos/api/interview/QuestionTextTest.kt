package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

/**
 * Cutting the reaction is worth doing, and cutting anything else is worse than leaving
 * the reaction in — so most of these are about what must survive untouched.
 */
class QuestionTextTest {
    @Test
    fun `drops a compliment and keeps the question`() {
        assertEquals(
            "How did you stop the projection lagging at peak?",
            QuestionText.withoutPreamble(
                "That's a great overview. How did you stop the projection lagging at peak?",
            ),
        )
    }

    @Test
    fun `drops a reaction phrased as an observation`() {
        assertEquals(
            "Could you walk me through how that system actually worked?",
            QuestionText.withoutPreamble(
                "That sounds really interesting. Could you walk me through how that system actually worked?",
            ),
        )
    }

    @Test
    fun `drops thanks`() {
        assertEquals(
            "What was the hardest part of that migration?",
            QuestionText.withoutPreamble("Thanks for sharing that. What was the hardest part of that migration?"),
        )
    }

    /**
     * The failure that would matter. A real interviewer cutting in is the behaviour the
     * product sells, and it opens with a short sentence that is not a question.
     */
    @Test
    fun `never cuts an interruption`() {
        val interruption = "Let me stop you there. What I'm after specifically is the failure mode."

        assertEquals(interruption, QuestionText.withoutPreamble(interruption))
    }

    @Test
    fun `never cuts a statement of fact about their work`() {
        val question =
            "That pipeline handled 400,000 transactions a day. How did you keep it consistent under load?"

        assertEquals(question, QuestionText.withoutPreamble(question))
    }

    @Test
    fun `never cuts when the first sentence is the question`() {
        val question = "How did you handle failures? I'm interested in the retry path specifically."

        assertEquals(question, QuestionText.withoutPreamble(question))
    }

    @Test
    fun `never cuts a single-sentence turn, however warm`() {
        // Removing this would leave nothing to ask.
        val only = "That's a great overview."

        assertEquals(only, QuestionText.withoutPreamble(only))
    }

    /**
     * The length guard, which exists so a long opening sentence is left alone even when
     * it happens to begin with words that usually signal a reaction. Past a certain
     * length a sentence is saying something, and cutting it would lose the thread.
     */
    @Test
    fun `never cuts a long opening, even one that starts like a reaction`() {
        val briefing =
            "That's a good point about the reconciliation window, and it is worth saying that the " +
                "finance team's constraint here was a hard regulatory one rather than a preference. " +
                "How would you design around that?"

        assertEquals(briefing, QuestionText.withoutPreamble(briefing))
    }

    /**
     * And the other side of that guard: a short compliment *is* cut, even a wordy one.
     * "That's a helpful picture of the scale you were working at" is preamble however
     * warmly it is phrased.
     */
    @Test
    fun `cuts a wordy compliment that is still only a compliment`() {
        assertEquals(
            "Let's move on to the design itself.",
            QuestionText.withoutPreamble(
                "That's a helpful picture of the constraints. Let's move on to the design itself.",
            ),
        )
    }

    /**
     * The reported exchange. The candidate says they never mentioned MasterControl; it is
     * on their resume, so the interviewer has every right to ask — but it apologised and
     * then asked again, which says both that it was wrong and that it was not.
     *
     * What survives is the half that does the work: where the detail came from, and the
     * question.
     */
    @Test
    fun `drops a reflexive apology and keeps the explanation`() {
        assertEquals(
            "The resume I have lists MasterControl, and a validation workflow engine project " +
                "there. Could you tell me about that project?",
            QuestionText.withoutPreamble(
                "My apologies. The resume I have lists MasterControl, and a validation workflow " +
                    "engine project there. Could you tell me about that project?",
            ),
        )
    }

    @Test
    fun `drops the other ways it says sorry`() {
        assertEquals(
            "Where did the requirement for two-phase commit come from?",
            QuestionText.withoutPreamble(
                "I apologise. Where did the requirement for two-phase commit come from?",
            ),
        )
        assertEquals(
            "What was your part in the migration itself?",
            QuestionText.withoutPreamble("Sorry, that was my error. What was your part in the migration itself?"),
        )
    }

    /**
     * "Sorry" inside a sentence is not an apology for anything — it is how people ask you
     * to repeat yourself, and cutting it would remove the question.
     */
    @Test
    fun `does not cut a sorry that is part of the question`() {
        val question = "Sorry, could you say that last part again?"

        assertEquals(question, QuestionText.withoutPreamble(question))
    }

    @Test
    fun `leaves an ordinary question alone`() {
        val question = "Walk me through the reconciliation engine."

        assertEquals(question, QuestionText.withoutPreamble(question))
    }

    @Test
    fun `handles empty and blank text without failing`() {
        assertEquals("", QuestionText.withoutPreamble(""))
        assertEquals("   ", QuestionText.withoutPreamble("   "))
    }
}
