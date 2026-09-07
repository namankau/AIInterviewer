package com.interviewos.api.sources

import org.springframework.stereotype.Component
import java.time.format.DateTimeFormatter

/**
 * Turns the curated library into grounding an interviewer can actually use, and into the
 * citations a report can show.
 *
 * This is the payoff for the whole library. Until now every question carried the tier
 * `model_knowledge` and an honest note saying we had nothing sourced behind it. Where
 * real material exists for an employer and round, the question can now be built on
 * documents the candidate is able to open and check, and the report says which.
 *
 * The rule that keeps this trustworthy is the same one everywhere else: **absence is
 * reported, never filled in.** No sources for an employer means the round runs on
 * archetype patterns and says so, exactly as before. Nothing here degrades into "close
 * enough" — Google's questions are not evidence about Google Cloud India.
 */
@Component
class SourceGrounding(
    private val repository: SourceRepository,
) {
    /**
     * What we actually know about how [companyName] runs a [roundType] round.
     *
     * Null when the library holds nothing, which is the common case and not a failure.
     */
    fun forRound(
        companyName: String,
        roundType: String,
    ): GroundedSources? {
        val questions = repository.questionsFor(companyName, roundType, MAX_QUESTIONS)
        if (questions.isEmpty()) return null
        return GroundedSources(questions)
    }

    private companion object {
        /**
         * Enough to steer a round without turning it into a recital. The interviewer is
         * meant to be informed by these, not to read them out in order.
         */
        const val MAX_QUESTIONS = 12
    }
}

data class GroundedSources(
    val questions: List<SourcedQuestion>,
) {
    /**
     * The material as the model should see it.
     *
     * Framed as reference rather than a script on purpose. A model handed a list of real
     * questions will read them out verbatim, which produces a question bank with extra
     * steps — and the product's whole claim is that it follows the candidate's answers.
     */
    fun asPrompt(): String =
        buildString {
            appendLine("Real questions reported for this employer and round, from sources we hold:")
            questions.forEach { question ->
                append("- \"")
                append(question.questionText.trim())
                append("\"")
                question.askedOn?.let { append(" (reported asked ${DATE.format(it)})") }
                question.seniority?.let { append(" [level: $it]") }
                question.notes?.takeIf { it.isNotBlank() }?.let { append(" — $it") }
                appendLine()
            }
            appendLine()
            appendLine(
                "Use these to judge what this employer actually cares about and how hard to push. " +
                    "Do NOT read them out in order or treat them as a script: the round still has to " +
                    "follow what the candidate says. Asking something close to one of these is right " +
                    "when it fits the conversation, and wrong when it does not.",
            )
        }

    /** What the report cites, deduplicated by source. */
    fun citations(): List<SourceCitation> =
        questions
            .distinctBy { it.sourceId }
            .map {
                SourceCitation(
                    title = it.title ?: it.url ?: "Untitled source",
                    publisher = it.publisher,
                    url = it.url,
                    year = it.publishedOn?.year,
                )
            }

    private companion object {
        val DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy")
    }
}

data class SourceCitation(
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
)
