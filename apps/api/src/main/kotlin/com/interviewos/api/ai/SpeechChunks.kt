package com.interviewos.api.ai

/**
 * Splitting a question into pieces that can be spoken in parallel.
 *
 * Gemini's speech latency scales with how much text it is given — measured against the
 * live API at 4.7s for a single sentence and 14.5s for a seventy-word paragraph. The
 * long ones are exactly the turns that matter most: the briefing that sets out how the
 * round will run, and any question carrying a scenario.
 *
 * Synthesising sentence by sentence and joining the audio turns that sum into a maximum.
 * The candidate waits for the slowest sentence rather than for all of them.
 *
 * The split is deliberately dull. It breaks on sentence endings only, and it merges
 * anything too short into its neighbour, because a chunk boundary mid-clause produces an
 * audible seam and a chunk of three words costs a whole request to save nothing.
 */
object SpeechChunks {
    /**
     * Below this many characters a chunk is merged forward: the request overhead is not
     * worth it, and short fragments are where the joins start to sound wrong.
     *
     * Set from what real questions look like rather than by feel. At 90 the commonest
     * shape of all — a short reaction to the last answer followed by the actual question,
     * "That pipeline sounds like a good place to start. Could you walk me through…" —
     * collapsed back into a single chunk and got no parallelism at all. The opening
     * clause of one of those runs about 60 characters.
     */
    private const val MINIMUM_CHUNK_CHARS = 45

    /**
     * A ceiling on parallel requests for one question. Splitting a very long passage into
     * a dozen calls trades latency for rate-limit risk, which is a bad trade mid-round.
     */
    private const val MAX_CHUNKS = 4

    /** Ends a sentence, when followed by whitespace. Abbreviations are not worth chasing. */
    private val SENTENCE_END = Regex("(?<=[.!?])\\s+")

    /**
     * [text] as chunks to synthesise. Always at least one, and the concatenation of the
     * chunks is the original text with single spaces at the joins — nothing is dropped.
     */
    fun split(text: String): List<String> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return listOf(text)

        val sentences = trimmed.split(SENTENCE_END).filter { it.isNotBlank() }
        if (sentences.size <= 1) return listOf(trimmed)

        val merged = mutableListOf<StringBuilder>()
        for (sentence in sentences) {
            val last = merged.lastOrNull()
            if (last != null && last.length < MINIMUM_CHUNK_CHARS) {
                last.append(' ').append(sentence)
            } else {
                merged.add(StringBuilder(sentence))
            }
        }

        // A trailing fragment gets folded back rather than left to stand on its own.
        if (merged.size > 1 && merged.last().length < MINIMUM_CHUNK_CHARS) {
            val tail = merged.removeAt(merged.size - 1)
            merged.last().append(' ').append(tail)
        }

        val chunks = merged.map { it.toString() }
        if (chunks.size <= MAX_CHUNKS) return chunks

        // Past the ceiling, redistribute rather than truncate: every word still gets said.
        val perChunk = (chunks.size + MAX_CHUNKS - 1) / MAX_CHUNKS
        return chunks.chunked(perChunk).map { it.joinToString(" ") }
    }
}
