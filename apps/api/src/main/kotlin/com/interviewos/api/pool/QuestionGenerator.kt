package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.Archetype
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

    // Bumped for task 041: the guidance now varies by archetype rather than asking the same
    // HR questions of a service-based IT firm and a global product company. See [guidance].
    override val version: Int = 2

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> =
        ai.generatePoolQuestions(
            PoolQuestionRequest(
                companyName = request.cell.companyName,
                archetype = request.cell.coordinate.archetype.label,
                roundType = roundType.label,
                roleFamily = request.cell.coordinate.roleFamily.label,
                level = request.cell.coordinate.level.label,
                roundGuidance = guidance(request.cell.coordinate.archetype),
                count = request.count,
                avoid = request.avoid,
                knowledge = request.knowledge,
            ),
        )

    /**
     * What this round is for, in the round type's own words, plus what actually differs by
     * [Archetype] — task 041's extension. A service-based IT firm's HR round runs on notice
     * period, bench policy and a bond or service agreement; a global product company's runs
     * on compensation banding and relocation. Asking the same five HR questions of both is
     * the "one set tagged seven ways" failure the technical-fundamentals generator was
     * written to avoid, and this round has the same shape of problem even though it has no
     * separate role-family axis to hang it on.
     *
     * Read off [RoundType] rather than written out again here, so the pool asks for the
     * same round the live interviewer runs. Two descriptions of the HR round that drifted
     * apart would give a candidate a pool question that does not belong in the round it
     * gets asked in.
     */
    private fun guidance(archetype: Archetype): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append("\n\n")
            append(archetypeEmphasis(archetype))
            append(
                "\n\nThis is the round where a candidate is most often asked about the employer itself. " +
                    "That makes it the round where an invented detail about a real company does the most " +
                    "damage, so the rule above about what you may treat as known is not a formality here.",
            )
        }

    /** What actually differs about the HR conversation for one kind of employer. */
    private fun archetypeEmphasis(archetype: Archetype): String =
        when (archetype) {
            Archetype.SERVICE_BASED_IT -> {
                "This is ${archetype.inProse}. Weight this round toward what is distinctive there: a notice " +
                    "period that may be long and negotiable only within limits, a service agreement or bond and " +
                    "what breaking it costs, redeployment onto a project or client they did not choose, and a " +
                    "compensation conversation anchored to a band and a hike percentage rather than an open " +
                    "negotiation."
            }

            Archetype.CONSULTING_BIG_FOUR -> {
                "This is ${archetype.inProse}. Weight this round toward travel and client-site expectations, " +
                    "a staffing and bench model rather than a fixed team, and up-or-out progression."
            }

            Archetype.EUROPEAN_EMPLOYER -> {
                "This is ${archetype.inProse}. Weight this round toward a frank, direct conversation on " +
                    "relocation and work-authorisation status, notice period under local norms, and " +
                    "compensation stated in the terms that employer's market actually uses."
            }

            Archetype.GLOBAL_PRODUCT, Archetype.INDIAN_PRODUCT -> {
                "This is ${archetype.inProse}. Weight this round toward compensation expectations asked " +
                    "directly, why this employer over its close competitors, and relocation where the role " +
                    "involves it."
            }

            Archetype.GCC_CAPTIVE -> {
                "This is ${archetype.inProse}. Weight this round toward what reporting into a captive centre " +
                    "actually means day to day — a global stakeholder in a different time zone, process and " +
                    "compliance expectations — alongside notice period and compensation."
            }

            Archetype.REGULATED_PROFESSIONAL -> {
                "This is ${archetype.inProse}. Weight this round toward fit for the practice and its standards " +
                    "of conduct, alongside notice period and compensation."
            }

            Archetype.INDUSTRIAL_MANUFACTURING -> {
                "This is ${archetype.inProse}. Weight this round toward site location, shift or plant-floor " +
                    "expectations where the role has them, alongside notice period and compensation."
            }
        }
}
