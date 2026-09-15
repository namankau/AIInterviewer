package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.interview.ProblemVerifier
import com.interviewos.api.interview.RoundType
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * The pool's `coding_practical` generator.
 *
 * Deliberately reuses [InterviewAi.composeProblem] and [ProblemVerifier] rather than a
 * second pipeline (task 040 spec): the same call a live DSA round makes to set its problem,
 * the same execution-backed check that a live round's `RoundWorkspace.verifiedProblem` runs.
 * The one difference from a live round is what happens on a result that is not verified —
 * `RoundWorkspace` keeps an unverified problem and shows it as such, because a candidate is
 * waiting; the pool has no candidate waiting and can simply not write the row. **A coding
 * problem whose reference solution does not pass its own test cases is never stored.**
 *
 * `PoolGenerationRequest.count` (`interviewos.pool.questions-per-cell`) is *not* honoured
 * as a batch size here. `composeProblem` writes one problem per call, and both the
 * generation job's spend cap and its rate limiter are checked once before `generate` is
 * called, not once per call a generator happens to make inside it — a generator that loops
 * `count` times internally could spend the whole run's budget in one cell before the job's
 * next between-cell check ever runs. So this writes **at most one problem per cell**, with
 * one retry on a disagreement between the two solutions (mirroring
 * `RoundWorkspace.verifiedProblem`'s own retry-once rule) and no retry on an unreachable
 * sandbox, which a second attempt cannot fix. A cell wanting more than one coding question
 * needs either a batched compose-problem prompt or generator access to the job's cap and
 * limiter — neither exists yet.
 */
@Component
class CodingQuestionGenerator(
    private val ai: InterviewAi,
    private val verifier: ProblemVerifier,
    private val objectMapper: ObjectMapper,
) : QuestionGenerator {
    private val log = LoggerFactory.getLogger(javaClass)

    override val roundType: RoundType = RoundType.CODING_PRACTICAL

    override val version: Int = 1

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> {
        val brief = briefFor(request)

        val first = attempt(brief)
        val chosen =
            when (first.verification.outcome) {
                ProblemVerifier.Verification.Outcome.VERIFIED -> {
                    first
                }

                ProblemVerifier.Verification.Outcome.INCONSISTENT -> {
                    log.info(
                        "The two solutions for a coding pool problem disagreed ({}); composing once more",
                        first.verification.reason,
                    )
                    attempt(brief).takeIf { it.verification.outcome == ProblemVerifier.Verification.Outcome.VERIFIED }
                }

                ProblemVerifier.Verification.Outcome.UNCHECKED -> {
                    null
                }
            }

        if (chosen == null) {
            log.warn(
                "No verified coding problem written for {}/{}/{}: {}",
                request.cell.coordinate.archetype.dbValue,
                request.cell.coordinate.roleFamily.dbValue,
                request.cell.coordinate.level.dbValue,
                first.verification.reason,
            )
            return AiResult(GeneratedQuestions(emptyList()), first.usage)
        }

        val problem = chosen.verification.problem
        val question =
            GeneratedQuestion(
                text = problem.statement,
                followUps = followUpsFor(problem),
                strongAnswerCovers = strongAnswerCoversFor(problem),
                // See the class comment: `composeProblem`'s own prompt already forbids
                // attributing the problem to the named employer, so nothing this generator
                // writes ever earns the stronger label.
                companySpecific = false,
                payload = objectMapper.valueToTree(payloadFor(problem)),
            )
        return AiResult(GeneratedQuestions(listOf(question)), chosen.usage)
    }

    private fun attempt(brief: InterviewBrief): Attempt {
        val composed = ai.composeProblem(brief, DURATION_MINUTES)
        return Attempt(composed.usage, verifier.verify(composed.value))
    }

    /**
     * The employer's name is passed through when there is one — `composeProblem`'s prompt
     * forbids the statement claiming the company asks it, so this only shapes tone and
     * calibration, never a fabricated specific. [PoolGenerationRequest.knowledge] is not
     * consulted: it licenses a `company_specific` claim, and this generator never makes one.
     */
    private fun briefFor(request: PoolGenerationRequest): InterviewBrief {
        val coordinate = request.cell.coordinate
        return InterviewBrief(
            company = request.cell.companyName ?: "an employer of this kind",
            archetype = coordinate.archetype.label,
            role = coordinate.roleFamily.label,
            roundType = roundType.label,
            roundCovers = roundType.covers.joinToString("\n") { "- $it" },
            language = "English",
            candidateFunction = coordinate.roleFamily.label,
            candidateLevel = coordinate.level.label,
            targetLevel = coordinate.level.label,
            grounding = groundingFor(request),
            plannedQuestion = null,
        )
    }

    private fun groundingFor(request: PoolGenerationRequest): String =
        buildString {
            append(
                "This problem is being written ahead of time for a pool of many candidates, not for one " +
                    "session — nothing here is specific to a resume. Vary the technique from the ones already " +
                    "used for this slot.",
            )
            if (request.avoid.isNotEmpty()) {
                append("\n\nAlready written for this exact slot — do not repeat any of these, even reworded:\n")
                append(request.avoid.joinToString("\n") { "- $it" })
            }
        }

    /**
     * Open-ended and true of any correct solution, rather than a claim about this specific
     * problem's feasible complexity — a follow-up asserting an optimisation that does not
     * exist would be a fabrication of a smaller kind than the ones this product exists to
     * avoid, but a fabrication regardless.
     */
    private fun followUpsFor(problem: ComposedProblem): List<String> =
        listOfNotNull(
            "What is the time and space complexity of your approach, and can either be improved?",
            problem.constraints.firstOrNull()?.let {
                "How would your approach change if $it changed by an order of magnitude?"
            } ?: "How would your approach change if the input were far larger than what is shown here?",
            "Walk through why your solution handles the edge case in the tests, not just the common one.",
        )

    private fun strongAnswerCoversFor(problem: ComposedProblem): List<String> =
        listOf(
            "scopes the ${problem.topic} problem and states assumptions before writing any code",
            "names the approach and explains why it beats a brute-force alternative",
            "states time and space complexity and defends the figures under questioning",
            "finds an edge case unprompted, such as ${problem.constraints.firstOrNull() ?: "an empty or boundary input"}",
        )

    private fun payloadFor(problem: ComposedProblem): CodingPoolPayload =
        CodingPoolPayload(
            topic = problem.topic,
            difficulty = problem.difficulty,
            statement = problem.statement,
            examples = problem.examples.map { PoolProblemExample(it.input, it.output, it.explanation) },
            constraints = problem.constraints,
            starterPython = problem.starterPython,
            starterJava = problem.starterJava,
            stdinFormat = problem.stdinFormat,
            testCases = problem.testCases.map { PoolProblemTestCase(it.input, it.expected) },
            testsVerified = problem.testsVerified,
        )

    private data class Attempt(
        val usage: AiUsage,
        val verification: ProblemVerifier.Verification,
    )

    private companion object {
        /** A coding pool problem is not scoped to any one session's actual round length. */
        const val DURATION_MINUTES = 40
    }
}
