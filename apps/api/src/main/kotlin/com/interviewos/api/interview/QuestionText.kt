package com.interviewos.api.interview

/**
 * Trims the reaction an interviewer does not need to give.
 *
 * Models open almost every follow-up with a verdict on the answer just given — "That's a
 * great overview.", "That sounds really interesting.", "Interesting." — and three
 * successive rounds of telling the prompt not to did not stop it. So it is enforced here
 * instead, where it either happens or does not.
 *
 * It is worth removing for two independent reasons. Praising every answer is the most
 * obvious tell of a machine, and it quietly tells a candidate they are doing well when
 * nothing has decided that — the opposite of what they came for. And every question is
 * read aloud, so a discarded sentence is a second or two less of the candidate sitting
 * in silence waiting to be asked something.
 *
 * **Deliberately conservative.** It removes a leading sentence only when that sentence is
 * clearly a reaction and something substantive follows it. A genuine interruption ("Let
 * me stop you there —"), a question in the first sentence, and anything it does not
 * recognise are all left exactly as written: an interviewer cut off mid-sentence is a
 * worse failure than one who was slightly too warm.
 */
object QuestionText {
    fun withoutPreamble(text: String): String {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return text

        val split = SENTENCE_END.find(trimmed) ?: return trimmed
        val first = trimmed.substring(0, split.range.last + 1).trim()
        val rest = trimmed.substring(split.range.last + 1).trim()

        // Nothing worth keeping after it, so whatever this is, it is the question.
        if (rest.length < MINIMUM_REMAINDER) return trimmed

        // A question in the opening sentence is the question, however it is phrased.
        if (first.contains('?')) return trimmed

        // Long enough to be carrying content rather than just being pleasant.
        if (first.length > MAXIMUM_REACTION) return trimmed

        val opener = first.lowercase()
        return if (REACTIONS.any { opener.startsWith(it) }) rest else trimmed
    }

    /** End of a sentence, followed by whitespace. */
    private val SENTENCE_END = Regex("[.!?]\\s+")

    /** Below this, the remainder is not a question and the "reaction" was the whole turn. */
    private const val MINIMUM_REMAINDER = 25

    /** Above this, the opening sentence is saying something rather than being warm. */
    private const val MAXIMUM_REACTION = 90

    /**
     * How these actually begin. Matched as prefixes on the lowercased sentence, so
     * "That's a great overview." and "That sounds really interesting." are both caught
     * while "That pipeline handled 400,000 transactions a day." is not — it is a
     * statement of fact about their work, and cutting it would lose the thread.
     */
    private val REACTIONS =
        listOf(
            "that's a ",
            "that's very ",
            "that's really ",
            "that's great",
            "that's interesting",
            "that's helpful",
            "that's clear",
            "that is a ",
            "that is very ",
            "that is really ",
            "that sounds ",
            "that makes sense",
            "that's a good",
            "that's fascinating",
            "interesting.",
            "interesting,",
            "great.",
            "great,",
            "great —",
            "excellent",
            "perfect",
            "wonderful",
            "nice.",
            "nice,",
            "good.",
            "good,",
            "makes sense",
            "i see.",
            "i see,",
            "understood",
            "got it",
            "thanks for that",
            "thanks for sharing",
            "thank you for that",
            "thank you for sharing",
            "okay, thanks",
            "ok, thanks",
        )
}
