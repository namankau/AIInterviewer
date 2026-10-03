package com.interviewos.api.interview

import tools.jackson.databind.ObjectMapper

/**
 * How one spoken answer was timed, measured in the browser from the microphone level
 * while it was recorded (`speech-timing.ts`).
 *
 * These are measurements, not judgements: when speech was first heard, how long it ran
 * from first sound to last, and the silences of a second or longer inside that span.
 * Nothing here says whether that was good — the report does that, server-side, from
 * these numbers and the transcript (`SpokenEnglish`).
 *
 * All durations are milliseconds.
 */
data class AnswerTiming(
    /** From the microphone opening to the answer being submitted. */
    val recordedMs: Long,
    /** From the microphone opening to the first sound loud enough to be speech. Null if none was. */
    val firstSoundMs: Long?,
    /** From the first speech to the last — trailing silence before submitting excluded. */
    val speakingMs: Long,
    /** Silences of [PAUSE_MS] or longer between the first speech and the last. */
    val pauseCount: Int,
    val longestPauseMs: Long,
    val totalPauseMs: Long,
) {
    companion object {
        /** What counts as a pause rather than the gap between two words. Mirrors the browser. */
        const val PAUSE_MS = 1_000L

        /** No answer runs this long; a value past it was not measured from a real answer. */
        private const val LONGEST_PLAUSIBLE_MS = 2 * 60 * 60 * 1_000L
        private const val MOST_PAUSES = 10_000

        /**
         * Reads the timing the browser sent, or null when it sent none or sent something
         * that cannot be a measurement of one answer.
         *
         * Never throws: a malformed meter reading is a reason to show "not measured" in
         * the report, not a reason to lose an answer the candidate has already given.
         */
        fun parse(
            json: String?,
            objectMapper: ObjectMapper,
        ): AnswerTiming? {
            if (json.isNullOrBlank()) return null
            val parsed =
                try {
                    objectMapper.readValue(json, AnswerTiming::class.java)
                } catch (e: RuntimeException) {
                    return null
                }
            return parsed?.takeIf { it.isConsistent() }
        }
    }

    /**
     * Whether these numbers could describe one real answer. Each is bounded by the one
     * that contains it: pauses sit inside the speaking span, the span sits inside the
     * recording after the first sound.
     */
    fun isConsistent(): Boolean {
        if (recordedMs !in 1..LONGEST_PLAUSIBLE_MS) return false
        if (pauseCount !in 0..MOST_PAUSES) return false
        if (speakingMs < 0 || longestPauseMs < 0 || totalPauseMs < 0) return false
        if (firstSoundMs == null) {
            // Nothing was heard, so there is nothing between a first and last word.
            return speakingMs == 0L && pauseCount == 0 && totalPauseMs == 0L && longestPauseMs == 0L
        }
        if (firstSoundMs !in 0..recordedMs) return false
        if (firstSoundMs + speakingMs > recordedMs) return false
        if (totalPauseMs > speakingMs || longestPauseMs > totalPauseMs) return false
        if (pauseCount == 0) return totalPauseMs == 0L && longestPauseMs == 0L
        return longestPauseMs >= PAUSE_MS && totalPauseMs >= pauseCount * PAUSE_MS
    }
}
