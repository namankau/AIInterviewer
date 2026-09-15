package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAnnotation

/**
 * Builds the report's per-question "how you could have answered it better" list from the
 * turns the candidate actually answered, joined with whatever notes the model wrote.
 *
 * The report prompt asks for one annotation per answered turn, in turn order, numbered the
 * same way `PromptLibrary.transcriptOf` numbers the transcript it is shown ("Turn 0", "Turn
 * 1", … is `turnIndex` 0, 1, …). That is a request, not a guarantee — the model can skip a
 * turn, write for one that does not exist, or omit a field the schema no longer allows to
 * be null. Trusting it to cover every turn is exactly the gap this exists to close:
 *
 * - **Every answered, non-warm-up turn gets an entry.** The question text comes from the
 *   turn itself, never from the model, so a note can never be shown against the wrong
 *   question.
 * - **A turn the model skipped still appears**, with an honest placeholder rather than
 *   vanishing from the report.
 * - **A note naming a turn that does not exist in this round is dropped.** It is simply
 *   never looked up, because the join runs the other way — from turns outward.
 *
 * Warm-up turns are excluded: `report.md` already says not to score them as competencies,
 * and "how could you have answered that better" has no sensible answer for "tell me about
 * yourself".
 */
object AnswerAnnotations {
    const val NO_NOTE = "No note was written for this answer."

    fun of(
        turns: List<TurnRow>,
        modelAnnotations: List<AnswerAnnotation>,
    ): List<AnswerAnnotation> {
        val byTurnIndex = modelAnnotations.associateBy { it.turnIndex }
        return turns.mapIndexedNotNull { index, turn ->
            if (TurnPhase.fromDbValue(turn.phase) == TurnPhase.WARMUP) return@mapIndexedNotNull null
            val note = byTurnIndex[index]
            AnswerAnnotation(
                turnIndex = index,
                question = turn.questionText,
                worked = note?.worked,
                vague = note?.vague,
                wouldProbe = note?.wouldProbe,
                strongerFraming = note?.strongerFraming?.takeIf { it.isNotBlank() } ?: NO_NOTE,
            )
        }
    }
}
