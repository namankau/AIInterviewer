package com.interviewos.api.pool

import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.bank.QuestionFingerprint

/**
 * Tidies what the model returned, and refuses what cannot be tidied.
 *
 * The database checks the same things — text not blank, two or three follow-ups, a
 * fingerprint that is not empty — and would reject a bad row with an exception that fails
 * the whole batch. Doing it here means one weak question out of six costs that one
 * question rather than the cell, which matters because the cell is a model call that has
 * already been paid for.
 *
 * It only ever trims and drops. It never invents a follow-up to reach the minimum: a
 * question that arrived with one follow-up is a question the model did not finish, and
 * padding it here would put text in front of a candidate that nothing wrote on purpose.
 */
object PoolQuestionSanitiser {
    private const val MAX_FOLLOW_UPS = 3
    private const val MIN_FOLLOW_UPS = 2
    private const val MAX_STRONG_ANSWER_POINTS = 6

    /** The question, tidied, or null when it cannot be made into a valid row. */
    fun sanitise(question: GeneratedQuestion): GeneratedQuestion? {
        val text = QuestionFingerprint.canonicalText(question.text)
        if (text.isBlank()) return null
        // A question that normalises to nothing — pure punctuation — has no fingerprint,
        // and the database's not-empty check would reject it.
        if (QuestionFingerprint.of(text).isEmpty()) return null

        val followUps =
            question.followUps
                .map { QuestionFingerprint.canonicalText(it) }
                .filter { it.isNotBlank() }
                .distinct()
                .take(MAX_FOLLOW_UPS)
        if (followUps.size < MIN_FOLLOW_UPS) return null

        val covers =
            question.strongAnswerCovers
                .map { QuestionFingerprint.canonicalText(it) }
                .filter { it.isNotBlank() }
                .distinct()
                .take(MAX_STRONG_ANSWER_POINTS)

        return question.copy(text = text, followUps = followUps, strongAnswerCovers = covers)
    }
}
