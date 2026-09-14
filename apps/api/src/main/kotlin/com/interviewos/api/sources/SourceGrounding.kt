package com.interviewos.api.sources

import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component
import java.time.format.DateTimeFormatter

/**
 * Turns the question bank into grounding an interviewer can actually use, and into the
 * citations a report can show.
 *
 * The rule that keeps this trustworthy is the same one everywhere else: **absence is
 * reported, never filled in.** No sourced questions for an employer means the round runs
 * on archetype patterns and says so. The employer is resolved through [CompanyDirectory],
 * exactly — Google's questions are not evidence about Google Cloud India, and an alias
 * (Facebook for Meta) is the only way a different name reaches the same questions.
 */
@Component
class SourceGrounding(
    private val directory: CompanyDirectory,
    private val bank: QuestionBankRepository,
) {
    /**
     * What we actually know about how [companyName] runs a [roundType] round.
     *
     * Null when the bank holds nothing, which is the common case and not a failure.
     */
    fun forRound(
        companyName: String,
        roundType: String,
    ): GroundedSources? {
        val company = directory.resolve(companyName) ?: return null
        val round = RoundType.parseOrNull(roundType) ?: return null
        val questions = bank.questionsFor(company.id, round, includeUnclassified = true, limit = MAX_QUESTIONS)
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
    val questions: List<BankQuestion>,
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
                append(question.text.trim())
                append("\"")
                question.lastReported?.let { append(" (last reported ${DATE.format(it)})") }
                if (question.corroboration > 1) append(" [reported by ${question.corroboration} sources]")
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
            .flatMap { it.citations }
            .distinctBy { it.sourceId }
            .map { SourceCitation(title = it.title, publisher = it.publisher, url = it.url, year = it.year) }

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
