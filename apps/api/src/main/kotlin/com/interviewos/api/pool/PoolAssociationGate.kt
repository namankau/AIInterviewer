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
 * A question that never claimed to be company-specific is unaffected: it is stored as
 * `employer_kind`, which is what it already was asking to be. **A question that DID claim
 * to be company-specific and is refused is dropped, not relabelled and kept.** That is
 * task 041's fix (PRD §04, §08) to what this file originally did: the earlier version stored
 * a refused claim as `employer_kind` with a `downgraded` flag, on the reasoning that "a
 * question that loses its claim is still a perfectly good question". It is not, when the
 * question's own `text` was written around the claim — "Tell me about a time you showed
 * Bias for Speed, one of Amazon's leadership principles" does not become a true statement
 * about the kind of employer just because the row it is stored under says `employer_kind`.
 * Relabelling does not un-fabricate a detail already sitting in the text a candidate reads,
 * and that is exactly the failure CLAUDE.md calls the most damaging this product has. So a
 * refused claim is dropped instead — the caller must not write the question at all.
 *
 * Every drop is counted, and the count goes in the run's note. A generator whose claims are
 * being refused ninety per cent of the time is a generator with a broken prompt, and that is
 * only visible if somebody is counting.
 */
object PoolAssociationGate {
    /**
     * @param dropped whether the model claimed the stronger label and did not get it — the
     *   caller must not write this question under any label. Counted per run, not per
     *   question, by the caller. False, including for every question that never claimed to
     *   be company-specific in the first place: nothing about those changes here.
     * @param reason why the claim was refused, for the log. Null when nothing was refused.
     */
    data class Decision(
        val association: Association,
        val knowledgeBasis: String?,
        val dropped: Boolean,
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

        fun refuse(reason: String) =
            Decision(
                // Meaningless when `dropped` is true — the caller never writes this
                // question, under this or any label. Set anyway so a question that never
                // claimed company-specific (the common case reaching this branch) still
                // gets a real association to be stored under.
                association = Association.EMPLOYER_KIND,
                // Kept even when dropped: it is what the model said about the employer, it
                // cost a call, and a reviewer asking "why was this refused" needs to read
                // it in the log line built from this decision.
                knowledgeBasis = basis,
                dropped = claimedCompanySpecific,
                reason = reason.takeIf { claimedCompanySpecific },
            )

        return when {
            companyId == null -> {
                refuse("the cell has no employer — it was generated for the archetype")
            }

            knowledge == null || !knowledge.knowsProcess -> {
                refuse("the model said it does not know this employer's process")
            }

            basis == null -> {
                refuse("the model said it knows the process but gave no account of what it knows")
            }

            // The one that catches the confident nothing. "Yes, I am familiar with their
            // interview process" with no round, value or format named is a model agreeing
            // with the question rather than answering it, and it is the most common way a
            // fabricated specific would get through.
            !knowledge.namesSomething -> {
                refuse("the model claimed knowledge but named no round, value or format")
            }

            vouchingModel != null && vouchingModel != writingModel -> {
                refuse("$writingModel wrote this, but it was $vouchingModel that vouched for knowing the employer")
            }

            !claimedCompanySpecific -> {
                Decision(Association.EMPLOYER_KIND, basis, dropped = false, reason = null)
            }

            else -> {
                Decision(Association.COMPANY_SPECIFIC, basis, dropped = false, reason = null)
            }
        }
    }
}
