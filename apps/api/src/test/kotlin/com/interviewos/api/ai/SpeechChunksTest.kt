package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SpeechChunksTest {
    /**
     * This assertion used to be the opposite way round, and the reversal is deliberate.
     *
     * It was written when questions ran to 200 characters and splitting them was the only
     * lever on the wait. Two things then changed. The response schema now caps a question
     * at 120 characters, so the single call is no longer slow enough to be worth escaping;
     * and measuring concurrency showed a real tail — four parallel calls returned a
     * straggler at 11.0s against 5.1s for its siblings, and one chunk came back at 34.7s
     * against a 5.5s median. The candidate waits for the slowest chunk.
     *
     * So a question this size is spoken in one call now: about 9 seconds, reliably,
     * instead of somewhere between 6 and 35.
     */
    @Test
    fun `a question short enough for one call is not fanned out`() {
        val chunks =
            SpeechChunks.split(
                "That settlement pipeline sounds like a great place to start. Could you walk me " +
                    "through how that system actually works, and what your role was in building it?",
            )

        assertEquals(1, chunks.size)
    }

    /** Past the threshold the trade flips, and a long turn is still worth splitting. */
    @Test
    fun `a long opening turn is still split`() {
        val opening =
            "Hi there, thanks for joining me today. I'm one of the engineers on the platform " +
                "team here. We've got about forty minutes, and this is the system design round " +
                "for the senior backend role. Before we get into it, could you walk me through " +
                "your background and what you've been working on lately?"

        val chunks = SpeechChunks.split(opening)

        assertTrue(opening.length >= 200, "the fixture has to be past the threshold to test it")
        assertTrue(chunks.size > 1, "a turn this long is faster as parallel sentences")
        assertEquals(
            opening.split(Regex("\\s+")),
            chunks.joinToString(" ").split(Regex("\\s+")),
            "splitting must not drop a word",
        )
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
