package com.interviewos.api.interview

import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.ReportContent

/**
 * Applies the assistance policy after the model has produced grounded evidence.
 *
 * The prompt is told to account for help, but a user-visible score cannot rely on the
 * model remembering to penalise itself consistently. A redirect or nudge costs one point;
 * being led to the answer or corrected costs two. The evidence remains visible, but it
 * cannot earn the same mark as the same answer produced independently.
 */
internal object ReportScoreCalibration {
    fun adjust(
        content: ReportContent,
        turns: List<TurnRow>,
    ): ReportContent {
        val helpByTurn = turns.associate { it.turnIndex to AssistanceSummary.helpOn(it) }
        return content.copy(
            competencies =
                content.competencies.map { score ->
                    val intervention = score.turnIndex?.let(helpByTurn::get) ?: Intervention.NONE
                    val deduction =
                        when (intervention) {
                            Intervention.NONE -> 0
                            Intervention.REDIRECTED, Intervention.HINTED -> 1
                            Intervention.GUIDED, Intervention.CORRECTED -> 2
                        }
                    if (deduction == 0) {
                        score
                    } else {
                        score.copy(
                            score = (score.score - deduction).coerceAtLeast(1),
                            rationale =
                                "Adjusted down because this evidence came after the candidate " +
                                    "${intervention.label.lowercase()}. " +
                                    score.rationale,
                        )
                    }
                },
        )
    }
}
