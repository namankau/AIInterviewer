package com.interviewos.api.interview

import com.interviewos.api.ai.Intervention

/**
 * How much the interviewer had to help, across a whole round.
 *
 * Computed from the recorded turns rather than asked of the model, because this is the
 * number the candidate is judged on and a model should not be free to be generous about
 * it. The model gets these counts as input and writes the narrative around them.
 *
 * [unaidedRatio] is the honest headline: the share of answers that stood on their own.
 * [creditedRatio] discounts each assisted turn by how much was given, so being nudged
 * once reads differently from being led through every answer.
 */
data class AssistanceSummary(
    val totalAnswers: Int,
    val unaidedAnswers: Int,
    val breakdown: Map<Intervention, Int>,
    val notes: List<String>,
) {
    val assistedAnswers: Int get() = totalAnswers - unaidedAnswers

    val unaidedRatio: Double
        get() = if (totalAnswers == 0) 0.0 else unaidedAnswers.toDouble() / totalAnswers

    /** Weighted by how much help each assisted turn actually needed. */
    val creditedRatio: Double
        get() {
            if (totalAnswers == 0) return 0.0
            val credit = breakdown.entries.sumOf { (intervention, count) -> intervention.credit * count }
            return credit / totalAnswers
        }

    /** One line for the model, and for the report header. */
    val headline: String
        get() =
            when {
                totalAnswers == 0 -> "No answers to assess."
                assistedAnswers == 0 -> "Answered all $totalAnswers questions unaided."
                unaidedAnswers == 0 -> "Needed help on every one of the $totalAnswers questions."
                else -> "Answered $unaidedAnswers of $totalAnswers unaided; needed help on $assistedAnswers."
            }

    /** The detail the report prompt is given, so its narrative matches the numbers. */
    fun promptContext(): String {
        if (totalAnswers == 0) return "No answers were recorded."
        val lines = mutableListOf(headline)
        breakdown
            .filterKeys { it.isAssisted }
            .filterValues { it > 0 }
            .forEach { (intervention, count) -> lines += "- ${intervention.label}: $count turn(s)" }
        notes.forEach { lines += "- help given: $it" }
        return lines.joinToString("\n")
    }

    companion object {
        fun of(turns: List<TurnRow>): AssistanceSummary {
            val answered = turns.filter { it.answerTranscript != null }
            val interventions = answered.map { Intervention.parse(it.intervention) }

            return AssistanceSummary(
                totalAnswers = answered.size,
                unaidedAnswers = interventions.count { !it.isAssisted },
                breakdown = interventions.groupingBy { it }.eachCount(),
                notes = answered.mapNotNull { it.interventionNote?.takeIf(String::isNotBlank) },
            )
        }
    }
}
