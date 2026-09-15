package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * Behavioural and competency questions, task 041 (PRD §08, §09).
 *
 * The round most tempted to fabricate. "Tell me about a time you showed Ownership" is a
 * good question only if the employer actually names Ownership as a thing it looks for, and
 * a model asked to write Amazon behavioural questions will reach for a leadership principle
 * whether or not the separate knowledge check actually licensed that one. So this generator
 * does not trust its own model's `companySpecific` flag the way [HrFitQuestionGenerator]
 * can: it also checks [GeneratedQuestion.valueClaimed] against the exact list
 * [PoolGenerationRequest.knowledge] named, and vetoes the claim itself, before
 * `PoolAssociationGate` ever sees it, whenever the two disagree.
 *
 * That is defence in depth, not a duplicate of the gate. The gate asks "did the knowledge
 * check license *any* company-specific claim for this employer". This asks the sharper
 * question the gate has no way to: "is this the value the check actually named, or a
 * different, equally plausible one the model reached for instead". A model that knows
 * Amazon has leadership principles and invents "Bias for Speed" instead of the real "Bias
 * for Action" passes the gate's check and fails this one.
 */
@Component
class BehaviouralCompetencyQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.BEHAVIOURAL_COMPETENCY

    override val version: Int = 1

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> {
        val result =
            ai.generatePoolQuestions(
                PoolQuestionRequest(
                    companyName = request.cell.companyName,
                    archetype = request.cell.coordinate.archetype.label,
                    roundType = roundType.label,
                    roleFamily = request.cell.coordinate.roleFamily.label,
                    level = request.cell.coordinate.level.label,
                    roundGuidance = guidance(),
                    count = request.count,
                    avoid = request.avoid,
                    knowledge = request.knowledge,
                ),
            )

        val licensedValues =
            request.knowledge
                ?.namedValues
                .orEmpty()
                .map { it.trim().lowercase() }
                .toSet()
        val sanitised =
            result.value.questions.map { question ->
                if (question.companySpecific && !claimIsLicensed(question.valueClaimed, licensedValues)) {
                    // Withdrawn here, in code, rather than left for `PoolAssociationGate` to
                    // catch on a coarser check. The gate would still downgrade a cell the
                    // knowledge check never licensed at all; this is the case where the
                    // check licensed something, just not the specific thing this question
                    // claims, and nothing downstream of the generator can tell those apart
                    // once the value name is only sitting in the question's own text.
                    question.copy(companySpecific = false, valueClaimed = null)
                } else {
                    question
                }
            }

        return AiResult(GeneratedQuestions(sanitised), result.usage)
    }

    /**
     * A claim with nothing named is never licensed, even if the model happened to tick
     * `companySpecific` true anyway — an unnamed value is indistinguishable from an
     * invented one and gets no benefit of the doubt.
     */
    private fun claimIsLicensed(
        valueClaimed: String?,
        licensedValues: Set<String>,
    ): Boolean {
        val claimed = valueClaimed?.trim()?.lowercase()
        return !claimed.isNullOrEmpty() && claimed in licensedValues
    }

    private fun guidance(): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append(
                "\n\nEvery question is a STAR prompt: it asks for one specific situation, not a policy or a " +
                    "general approach. The follow-ups are STAR follow-ups, reaching for the part candidates " +
                    "skip over — what was actually theirs to decide versus the team's, what the measurable " +
                    "result was, and what they would do differently now. A follow-up that just asks for more " +
                    "detail on the same beat is not doing its job.\n\n" +
                    "Where an employer's own values are genuinely known (see below), one behavioural question " +
                    "may be built around a single one of them, named exactly as given and carried in " +
                    "`valueClaimed`. Where they are not known, ask about the kind of situation this kind of " +
                    "employer probes — disagreement, ownership of a failure, a deadline that could not be met " +
                    "— without naming or implying a specific value the employer is said to hold.",
            )
        }
}
