package com.interviewos.api.bank

import com.interviewos.api.ai.ExtractedQuestion
import com.interviewos.api.interview.RoundType
import java.time.LocalDate

/**
 * What one source's extraction becomes, before anything is written.
 *
 * Pure, so the rules that decide which company a question is filed under are tested
 * without a database:
 *
 * - The companies are the employers the document says asked it. Groups ("FAANG") and
 *   non-names are dropped — they are not employers.
 * - If the document names none, the source's declared company is used: the operator who
 *   added it said what it is about.
 * - If there is neither, the question is still a report, just an untagged one. It enters
 *   the bank but appears under no company, which is honest.
 * - The same question listed twice by one source is one question, with the companies of
 *   both mentions. One source is one corroboration however often it repeats itself.
 * - Text that is nothing but punctuation is not a question.
 */
object ReportPlan {
    fun plan(
        questions: List<ExtractedQuestion>,
        declaredCompany: String?,
    ): List<PlannedQuestion> {
        val fallback = declaredCompany?.takeIf { EmployerNames.isNamedEmployer(it) }?.let { EmployerNames.displayName(it) }
        val byFingerprint = LinkedHashMap<String, PlannedQuestion>()

        questions.forEach { question ->
            val text = QuestionFingerprint.canonicalText(question.questionText)
            val fingerprint = QuestionFingerprint.of(text)
            if (fingerprint.isEmpty()) return@forEach

            val named =
                question.companies
                    .filter { EmployerNames.isNamedEmployer(it) }
                    .map { EmployerNames.displayName(it) }
            val companies = named.ifEmpty { listOfNotNull(fallback) }

            val planned =
                PlannedQuestion(
                    text = text,
                    fingerprint = fingerprint,
                    companies = companies.distinctBy { EmployerNames.lookupKey(it) },
                    roundType = question.roundType?.let { RoundType.parseOrNull(it.trim()) },
                    seniority = question.seniority?.trim()?.takeIf { it.isNotEmpty() },
                    roleFamily = question.roleFamily?.trim()?.takeIf { it.isNotEmpty() },
                    askedOn = question.askedOn,
                    notes = question.notes?.trim()?.takeIf { it.isNotEmpty() },
                )

            byFingerprint.merge(fingerprint, planned) { first, again ->
                first.copy(
                    companies = (first.companies + again.companies).distinctBy { EmployerNames.lookupKey(it) },
                    roundType = first.roundType ?: again.roundType,
                    seniority = first.seniority ?: again.seniority,
                    roleFamily = first.roleFamily ?: again.roleFamily,
                    askedOn = listOfNotNull(first.askedOn, again.askedOn).maxOrNull(),
                    notes = first.notes ?: again.notes,
                )
            }
        }
        return byFingerprint.values.toList()
    }
}

/** One question a source reports, with every employer it reports it at. */
data class PlannedQuestion(
    /** The source's wording, whitespace tidied. Becomes the bank text if it is the first report. */
    val text: String,
    val fingerprint: String,
    /** Display names, one per employer. Empty means an untagged report. */
    val companies: List<String>,
    val roundType: RoundType?,
    val seniority: String?,
    val roleFamily: String?,
    val askedOn: LocalDate?,
    val notes: String?,
)
