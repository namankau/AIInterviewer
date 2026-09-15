package com.interviewos.api.pool

import com.interviewos.api.ai.EmployerKnowledge
import java.util.UUID

/**
 * Decides what a generated question is allowed to claim about a real employer.
 *
 * **This is the rule the whole pool exists under, and it is enforced here in Kotlin rather
 * than in the prompt.** A prompt is a request; a model that has just written six fluent
 * questions about Amazon will tick `companySpecific` on all six whatever it said sixty
 * seconds earlier, because by then it has an answer to be consistent with. So the model's
 * claim is treated as exactly that — a claim — and this decides.
 *
 * It only ever decides downwards. There is no input that turns an `employer_kind` question
 * into a `company_specific` one; every path either keeps the claim or withdraws it. A
 * question that loses its claim is still a perfectly good question, it is just labelled as
 * being about the kind of employer, which is what it actually is.
 *
 * Every withdrawal is counted, and the count goes in the run report. A generator whose
 * claims are being withdrawn ninety per cent of the time is a generator whose prompt is
 * wrong, and that is only visible if somebody is counting.
 */
object PoolAssociationGate {
    /**
     * @param downgraded whether the model claimed the stronger label and did not get it.
     *   Counted per run, not per question, by the caller.
     * @param reason why it was withdrawn, for the log. Null when nothing was withdrawn.
     */
    data class Decision(
        val association: Association,
        val knowledgeBasis: String?,
        val downgraded: Boolean,
        val reason: String?,
    )

    /**
     * @param companyId null for an archetype-level cell, where there is no employer to be
     *   specific about in the first place
     * @param claimedCompanySpecific the model's own claim on this question
     * @param knowledge what the model answered when it was asked, before writing anything,
     *   whether it knows this employer's process
     * @param vouchingModel which model answered that question
     * @param writingModel which model actually wrote this question. Not necessarily the
     *   same one: the chain falls through, and a claim is only worth anything from the
     *   model that made it.
     */
    fun decide(
        companyId: UUID?,
        claimedCompanySpecific: Boolean,
        knowledge: EmployerKnowledge?,
        vouchingModel: String?,
        writingModel: String,
    ): Decision {
        val basis = knowledge?.basis?.trim()?.takeIf { it.isNotEmpty() }

        fun withdraw(reason: String) =
            Decision(
                association = Association.EMPLOYER_KIND,
                // Kept even on an archetype-level row: it is what the model said about the
                // employer, it cost a call, and a reviewer asking "why was this downgraded"
                // needs to read it. The database allows it here and requires it above.
                knowledgeBasis = basis,
                downgraded = claimedCompanySpecific,
                reason = reason.takeIf { claimedCompanySpecific },
            )

        return when {
            companyId == null -> {
                withdraw("the cell has no employer — it was generated for the archetype")
            }

            knowledge == null || !knowledge.knowsProcess -> {
                withdraw("the model said it does not know this employer's process")
            }

            basis == null -> {
                withdraw("the model said it knows the process but gave no account of what it knows")
            }

            // The one that catches the confident nothing. "Yes, I am familiar with their
            // interview process" with no round, value or format named is a model agreeing
            // with the question rather than answering it, and it is the most common way a
            // fabricated specific would get through.
            !knowledge.namesSomething -> {
                withdraw("the model claimed knowledge but named no round, value or format")
            }

            vouchingModel != null && vouchingModel != writingModel -> {
                withdraw("$writingModel wrote this, but it was $vouchingModel that vouched for knowing the employer")
            }

            !claimedCompanySpecific -> {
                Decision(Association.EMPLOYER_KIND, basis, downgraded = false, reason = null)
            }

            else -> {
                Decision(Association.COMPANY_SPECIFIC, basis, downgraded = false, reason = null)
            }
        }
    }
}
