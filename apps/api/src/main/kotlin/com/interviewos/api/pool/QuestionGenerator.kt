package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * Writes the pool's questions for one round type.
 *
 * One implementation per round type, because the round types are not variations on a
 * theme: a system design case and an HR closing question need different things asked, at
 * different lengths, with different ideas of what a strong answer contains. Tasks 040 and
 * 041 add the rest; this task ships one so the job can be exercised end to end.
 *
 * A generator does not decide what a question may claim about an employer. It passes on
 * the model's claim and `PoolAssociationGate` rules on it — see [PoolGenerationJob].
 */
interface QuestionGenerator {
    /** The round type this generator writes for. Exactly one generator per round type. */
    val roundType: RoundType

    /**
     * Bumped when this generator's prompt changes enough that its output is no longer
     * comparable with what it wrote before. Stored on every row, so a review can tell
     * which prompt produced which question.
     */
    val version: Int

    fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions>
}

/** What a generator is asked for. */
data class PoolGenerationRequest(
    val cell: PoolCell,
    val count: Int,
    /** Questions already held for this coordinate, so the model is not asked to repeat itself. */
    val avoid: List<String>,
    /** The knowledge check's answer, or null for an archetype-level cell. */
    val knowledge: EmployerKnowledge?,
)

/**
 * The reference generator: HR and fit, the closing round.
 *
 * Chosen as the one to ship here because it is the round with the least machinery around
 * it — no problem to compose, no code to run, no case to keep consistent — so it exercises
 * the job, the gate, the deduplicator and the export without any of its own complexity
 * getting in the way of seeing whether those work.
 *
 * It is also the round where the provenance gate matters most in practice. "Why do you want
 * to work here", asked well, is unavoidably about the employer, and it is the question a
 * model is most willing to answer with invented specifics about a real company's values.
 */
@Component
class HrFitQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.HR_FIT_CLOSING

    override val version: Int = 1

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> =
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

    /**
     * What this round is for, in the round type's own words.
     *
     * Read off [RoundType] rather than written out again here, so the pool asks for the
     * same round the live interviewer runs. Two descriptions of the HR round that drifted
     * apart would give a candidate a pool question that does not belong in the round it
     * gets asked in.
     */
    private fun guidance(): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append(
                "\n\nThis is the round where a candidate is most often asked about the employer itself. " +
                    "That makes it the round where an invented detail about a real company does the most " +
                    "damage, so the rule above about what you may treat as known is not a formality here.",
            )
        }
}
