package com.interviewos.api.interview

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.PlannedQuestion
import com.interviewos.api.bank.BankQuestion
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * The material a round is conducted around, and the first thing the interviewer says
 * about it.
 *
 * Two rounds need more on screen than a question: a DSA round needs a problem and
 * somewhere to type, a system design round needs a case and somewhere to draw. Everything
 * else is a conversation and gets no workspace at all — a behavioural round with a canvas
 * bolted to it would be a worse behavioural round.
 *
 * **The opening is templated from the workspace rather than asked of the model.** Once
 * the problem exists, what the interviewer says to open is not an interesting question —
 * it is "here it is, read it out and talk me through your approach". Composing that
 * separately would be a second model call, a second thing to go wrong, and several more
 * seconds of the candidate watching a spinner during setup, which is already the thing
 * they complain about. So these rounds make exactly one call where the others make one.
 */
@Component
class RoundWorkspaceComposer(
    private val interviewAi: InterviewAi,
    private val objectMapper: ObjectMapper,
    private val problemVerifier: ProblemVerifier,
    private val poolMaterial: PoolMaterial,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * The workspace for [roundType], or null if this round needs none.
     *
     * A failure here is not fatal and deliberately so. The material is what makes the
     * round *good*; the interviewer, the microphone and the transcript are what make it a
     * round at all. A candidate whose problem failed to compose gets a spoken round with
     * an apology, which is worth far more than a dead session — and the caller records
     * that it happened.
     *
     * @param seed a question from the company's bank for this round. The problem or case is
     *   composed as that question, written out, and the workspace carries it only when what
     *   came back still asks it — material that drifted into something else is kept, but not
     *   labelled as reported.
     */
    fun compose(
        brief: InterviewBrief,
        roundType: RoundType,
        durationMinutes: Int,
        seed: BankQuestion? = null,
    ): RoundWorkspace? {
        val seeded = seed?.let { brief.copy(plannedQuestion = PlannedQuestion(it.text, brief.company, askNow = true)) } ?: brief
        return try {
            when (roundType) {
                RoundType.CODING_PRACTICAL -> problemWorkspace(seeded, durationMinutes, seed)
                RoundType.SYSTEM_DESIGN -> caseWorkspace(seeded, durationMinutes, seed)
                else -> null
            }
        } catch (e: AiUnavailableException) {
            log.warn("Workspace composition failed for a {} round; it runs as a spoken round", roundType.dbValue, e)
            null
        }
    }

    /**
     * The workspace for a round set on a pool question, or null when [pick] carries no
     * material for [roundType].
     *
     * No model call and no verification: the problem was composed and its tests checked
     * when the pool was generated, which is the whole of the latency the pool saves. The
     * opening is templated exactly as a composed round's is.
     */
    fun fromPool(
        pick: PlannedFrom.Pool,
        roundType: RoundType,
        durationMinutes: Int,
    ): RoundWorkspace? =
        when (roundType) {
            RoundType.CODING_PRACTICAL -> {
                poolMaterial.problemOf(pick.question)?.let { problem ->
                    RoundWorkspace(
                        json = objectMapper.writeValueAsString(ProblemPayload(problem = problem)),
                        openingQuestion = openingForProblem(problem, durationMinutes),
                        probes = PROBLEM_PROBES,
                        basis = "",
                        askedBecause = PROBLEM_ASKED_BECAUSE,
                        poolQuestion = pick,
                    )
                }
            }

            RoundType.SYSTEM_DESIGN -> {
                poolMaterial.caseOf(pick.question)?.let { case ->
                    RoundWorkspace(
                        json = objectMapper.writeValueAsString(CasePayload(case = case)),
                        openingQuestion = case.openingPrompt,
                        probes = CASE_PROBES,
                        basis = "",
                        askedBecause = CASE_ASKED_BECAUSE,
                        poolQuestion = pick,
                    )
                }
            }

            else -> {
                null
            }
        }

    /** [seed], when [material] still asks it; otherwise null, and said in the log. */
    private fun keptSeed(
        seed: BankQuestion?,
        material: String,
    ): BankQuestion? {
        if (seed == null) return null
        if (PlannedQuestionCheck.asks(material, seed.text)) return seed
        log.warn("The composed workspace does not ask bank question {}; it is not labelled as reported", seed.id)
        return null
    }

    private fun problemWorkspace(
        brief: InterviewBrief,
        durationMinutes: Int,
        seed: BankQuestion?,
    ): RoundWorkspace {
        val problem = verifiedProblem(brief, durationMinutes)
        val reported = keptSeed(seed, "${problem.title}. ${problem.statement}")
        return RoundWorkspace(
            // The solutions go no further than this. What is stored is what the browser is
            // sent, and a solution in the page source is a solution handed over.
            json =
                objectMapper.writeValueAsString(
                    ProblemPayload(
                        problem = problem.copy(referencePython = null, bruteForcePython = null),
                        bankQuestionId = reported?.id?.toString(),
                    ),
                ),
            openingQuestion = openingForProblem(problem, durationMinutes),
            probes = PROBLEM_PROBES,
            basis =
                if (reported != null) {
                    "A question reported for ${brief.company}'s coding rounds, written out as a problem to run."
                } else {
                    "A ${problem.difficulty} problem on ${problem.topic}, of the kind this round asks at this level."
                },
            askedBecause = PROBLEM_ASKED_BECAUSE,
            bankQuestion = reported,
        )
    }

    /**
     * A problem whose expected outputs have been checked by running two solutions.
     *
     * Composed a second time only when the model's own two solutions disagreed — that
     * means it does not have a consistent reading of the problem it wrote, which is the one
     * failure a fresh attempt can fix. An unreachable sandbox is not: the problem is kept
     * and shown as unverified. Costs about 3.5s of setup on a DSA round (measured), for
     * test cases that are right.
     */
    private fun verifiedProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): ComposedProblem {
        val first = problemVerifier.verify(interviewAi.composeProblem(brief, durationMinutes).value)
        if (first.outcome != ProblemVerifier.Verification.Outcome.INCONSISTENT) return first.problem

        log.warn("The model's two solutions disagreed ({}); composing the problem once more", first.reason)
        val second =
            try {
                problemVerifier.verify(interviewAi.composeProblem(brief, durationMinutes).value)
            } catch (e: AiUnavailableException) {
                log.warn("The second attempt at a problem failed; keeping the first, unverified", e)
                return first.problem
            }
        return second.problem
    }

    private fun caseWorkspace(
        brief: InterviewBrief,
        durationMinutes: Int,
        seed: BankQuestion?,
    ): RoundWorkspace {
        val case = interviewAi.composeCase(brief, durationMinutes).value
        val reported = keptSeed(seed, "${case.title}. ${case.summary} ${case.openingPrompt}")
        return RoundWorkspace(
            json = objectMapper.writeValueAsString(CasePayload(case = case, bankQuestionId = reported?.id?.toString())),
            openingQuestion = case.openingPrompt,
            probes = CASE_PROBES,
            basis =
                if (reported != null) {
                    "A question reported for ${brief.company}'s design rounds, written out as a case with its scale."
                } else {
                    "A design case of the kind this round sets at this level, with the scale that forces the trade-off."
                },
            askedBecause = CASE_ASKED_BECAUSE,
            bankQuestion = reported,
        )
    }

    /**
     * What the interviewer says to open a DSA round.
     *
     * It asks them to read the problem aloud on purpose. A candidate who reads it out has
     * to slow down enough to notice what it actually says, and an interviewer listening to
     * them do it learns something before a line is written. It is also the least awkward
     * possible way to start a spoken round in front of a screen full of text.
     */
    private fun openingForProblem(
        problem: ComposedProblem,
        durationMinutes: Int,
    ): String =
        "We've got about $durationMinutes minutes. Your problem is on the left — " +
            "${problem.title}. Read it out loud for me, then talk me through how you'd " +
            "approach it before you write anything."

    companion object {
        /** The round types conducted around a workspace. */
        val ROUND_TYPES: Set<RoundType> = setOf(RoundType.CODING_PRACTICAL, RoundType.SYSTEM_DESIGN)

        private const val PROBLEM_PROBES = "How they scope and reason about a problem before writing code."
        private const val PROBLEM_ASKED_BECAUSE =
            "It is the problem set for this round. Everything after this follows from how you approach it."
        private const val CASE_PROBES = "Whether they narrow an open problem before designing for it."
        private const val CASE_ASKED_BECAUSE =
            "It is the case set for this round. How you scope it decides what the rest of the hour is about."
    }

    /** [bankQuestionId] is set when the material is a reported question; see [RoundWorkspace.bankQuestion]. */
    private data class ProblemPayload(
        val kind: String = "dsa",
        val problem: ComposedProblem,
        val bankQuestionId: String? = null,
    )

    private data class CasePayload(
        val kind: String = "system_design",
        val case: ComposedCase,
        val bankQuestionId: String? = null,
    )
}

/**
 * A composed workspace, ready to store and to open the round with.
 *
 * [json] is what the client renders and what the report reads back. The rest is the
 * opening turn, carrying the same provenance fields every other question carries — a
 * templated question is still a question the candidate is entitled to see the reasoning
 * behind.
 */
data class RoundWorkspace(
    val json: String,
    val openingQuestion: String,
    val probes: String,
    val basis: String,
    val askedBecause: String,
    /** The bank question the material is, when it was seeded with one and still asks it. */
    val bankQuestion: BankQuestion? = null,
    /** The pool question the material was read from, when the round is set on one. */
    val poolQuestion: PlannedFrom.Pool? = null,
)
