package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SpeechChunksTest {
    /**
     * The regression this exists for. The commonest question in a round is a short
     * reaction to the last answer followed by the real question, and a threshold tuned by
     * feel merged the two back into one chunk — so the parallel synthesis that was meant
     * to halve the wait did nothing at all on the majority of turns.
     */
    @Test
    fun `a reaction followed by a question is split, not merged`() {
        val chunks =
            SpeechChunks.split(
                "That settlement pipeline sounds like a great place to start. Could you walk me " +
                    "through how that system actually works, and what your role was in building it?",
            )

        assertEquals(2, chunks.size)
    }

    @Test
    fun `a single sentence is left alone`() {
        val chunks = SpeechChunks.split("How did you handle failures in that pipeline?")

        assertEquals(1, chunks.size)
    }

    /** Nothing may be dropped on the way to being spoken. */
    @Test
    fun `the chunks say everything the question said`() {
        val question =
            "Thanks for that. We're moving on to the design portion now. We have about thirty " +
                "minutes left. Let's design a global digital wallet for a ride-sharing service."

        val rejoined = SpeechChunks.split(question).joinToString(" ")

        assertEquals(question.split(Regex("\\s+")), rejoined.split(Regex("\\s+")))
    }

    @Test
    fun `a very long passage is bounded rather than fanned out indefinitely`() {
        val manySentences = (1..20).joinToString(" ") { "This is sentence number $it in a long passage." }

        val chunks = SpeechChunks.split(manySentences)

        assertTrue(chunks.size <= 4, "was ${chunks.size}; unbounded fan-out trades latency for rate limits")
        assertEquals(
            manySentences.split(Regex("\\s+")),
            chunks.joinToString(" ").split(Regex("\\s+")),
            "redistributing must not drop a word",
        )
    }

    @Test
    fun `empty and blank text still produce something to speak`() {
        assertEquals(1, SpeechChunks.split("").size)
        assertEquals(1, SpeechChunks.split("   ").size)
    }

    @Test
    fun `a trailing fragment is folded back rather than left to stand alone`() {
        // "Right." on its own would cost a whole request and produce an audible seam.
        val chunks = SpeechChunks.split("Walk me through the projection pipeline you built for that ledger. Right.")

        assertEquals(1, chunks.size)
    }
}
