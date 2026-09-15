package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.interview.RoundType
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * The pool's `system_design` generator.
 *
 * Reuses [InterviewAi.composeCase] — the same call a live design round makes to set its
 * case — rather than a second pipeline. Follow-ups come straight from
 * [ComposedCase.deepDiveOptions]: a design case already names 2-3 areas worth pushing on in
 * the same call, so nothing further needs asking for them.
 *
 * **LLD / machine-coding and distributed design are tagged within this one round type, not
 * split into a second `round_type` enum value.** The tag lives in the jsonb payload
 * ([SystemDesignPoolPayload.designTag]) rather than as a new column, because it is detail
 * about one system-design question rather than a different kind of thing — the case still
 * carries the same shared columns (`follow_ups`, `strong_answer_covers`, `association`)
 * regardless of which it is, and a nullable column that only one round type ever sets is a
 * worse fit than a field inside the payload that already exists for exactly this. Chosen by
 * the cell's level, as task 040 specifies: machine-coding at `entry`/`mid`, where a
 * candidate can complete a self-contained design in the time; distributed design at
 * `senior`/`staff`, where the interesting judgement is about a system that spans processes.
 *
 * Like [CodingQuestionGenerator], this writes **at most one case per cell** regardless of
 * `PoolGenerationRequest.count` — see that class's comment for why looping internally would
 * let one cell spend past the run's cap before the job's next between-cell check runs.
 */
@Component
class SystemDesignQuestionGenerator(
    private val ai: InterviewAi,
    private val objectMapper: ObjectMapper,
) : QuestionGenerator {
    private val log = LoggerFactory.getLogger(javaClass)

    override val roundType: RoundType = RoundType.SYSTEM_DESIGN

    override val version: Int = 1

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> {
        val tag = tagFor(request.cell.coordinate.level)
        val brief = briefFor(request, tag)

        val composed = ai.composeCase(brief, DURATION_MINUTES)
        val case = composed.value

        if (!wellFormed(case)) {
            log.warn(
                "Dropping a malformed system-design case for {}/{}/{}: missing an opening prompt, " +
                    "constraints or deep-dive options",
                request.cell.coordinate.archetype.dbValue,
                request.cell.coordinate.roleFamily.dbValue,
                request.cell.coordinate.level.dbValue,
            )
            return AiResult(GeneratedQuestions(emptyList()), composed.usage)
        }

        val question =
            GeneratedQuestion(
                text = case.openingPrompt,
                followUps = case.deepDiveOptions.take(MAX_FOLLOW_UPS),
                strongAnswerCovers = strongAnswerCoversFor(tag, case),
                // See the class comment: `composeCase`'s own prompt already forbids
                // attributing the case to the named employer, so nothing this generator
                // writes ever earns the stronger label.
                companySpecific = false,
                payload = objectMapper.valueToTree(payloadFor(tag, case)),
            )
        return AiResult(GeneratedQuestions(listOf(question)), composed.usage)
    }

    /** Machine-coding at entry/mid, where a self-contained design fits the time; distributed design above that. */
    private fun tagFor(level: Level): DesignTag =
        when (level) {
            Level.ENTRY, Level.MID -> DesignTag.MACHINE_CODING
            Level.SENIOR, Level.STAFF -> DesignTag.DISTRIBUTED_DESIGN
        }

    private fun briefFor(
        request: PoolGenerationRequest,
        tag: DesignTag,
    ): InterviewBrief {
        val coordinate = request.cell.coordinate
        return InterviewBrief(
            company = request.cell.companyName ?: "an employer of this kind",
            archetype = coordinate.archetype.label,
            role = coordinate.roleFamily.label,
            roundType = roundType.label,
            roundCovers = roundCoversFor(tag, request.avoid),
            language = "English",
            candidateFunction = coordinate.roleFamily.label,
            candidateLevel = coordinate.level.label,
            targetLevel = coordinate.level.label,
            grounding = GROUNDING,
            plannedQuestion = null,
        )
    }

    private fun roundCoversFor(
        tag: DesignTag,
        avoid: List<String>,
    ): String =
        buildString {
            append(
                when (tag) {
                    DesignTag.MACHINE_CODING -> {
                        "This case is a machine-coding / low-level design problem: one component or data " +
                            "structure — a cache, a rate limiter, a job scheduler, an in-memory index — designed " +
                            "and reasoned about on its own, not a distributed system with multiple services."
                    }

                    DesignTag.DISTRIBUTED_DESIGN -> {
                        "This case is a distributed-systems design problem at real scale: networked services, " +
                            "a data store that has to be chosen and justified, and a failure mode that crosses a " +
                            "process boundary. Not a single in-process data structure."
                    }
                },
            )
            append("\n\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            if (avoid.isNotEmpty()) {
                append("\n\nAlready written for this exact slot — do not repeat any of these, even reworded:\n")
                append(avoid.joinToString("\n") { "- $it" })
            }
        }

    private fun wellFormed(case: ComposedCase): Boolean =
        case.title.isNotBlank() &&
            case.summary.isNotBlank() &&
            case.openingPrompt.isNotBlank() &&
            case.constraints.isNotEmpty() &&
            case.deepDiveOptions.isNotEmpty()

    private fun strongAnswerCoversFor(
        tag: DesignTag,
        case: ComposedCase,
    ): List<String> =
        when (tag) {
            DesignTag.MACHINE_CODING -> {
                listOf(
                    "clarifies the exact operations required, and their complexity budget, before designing",
                    "chooses data structures that make the stated operations cheap, and says why",
                    "considers concurrent access if the case calls for it",
                    "checks the design against ${case.constraints.firstOrNull() ?: "the stated scale"}",
                )
            }

            DesignTag.DISTRIBUTED_DESIGN -> {
                listOf(
                    "narrows requirements and scale before naming a single component",
                    "a high-level design that holds up against ${case.constraints.firstOrNull() ?: "the stated numbers"}",
                    "names what breaks first, and what happens when it does",
                    "defends the trade-off it made when pushed on it",
                )
            }
        }

    private fun weakAnswerMissesFor(tag: DesignTag): List<String> =
        when (tag) {
            DesignTag.MACHINE_CODING -> {
                listOf(
                    "starts writing code before agreeing what the operations are",
                    "picks a data structure without checking it against the complexity the case needs",
                    "never mentions what happens under concurrent access",
                )
            }

            DesignTag.DISTRIBUTED_DESIGN -> {
                listOf(
                    "names components before establishing requirements or scale",
                    "has no answer for what breaks first, or what happens when it does",
                    "cannot defend the trade-off it made once pushed on it",
                )
            }
        }

    private fun payloadFor(
        tag: DesignTag,
        case: ComposedCase,
    ): SystemDesignPoolPayload =
        SystemDesignPoolPayload(
            designTag = tag.dbValue,
            title = case.title,
            summary = case.summary,
            constraints = case.constraints,
            weakAnswerMisses = weakAnswerMissesFor(tag),
        )

    private companion object {
        /** A pool design case is not scoped to any one session's actual round length. */
        const val DURATION_MINUTES = 45

        /** The schema and the prompt both ask for 2-3; this keeps a generator that returns more honest. */
        const val MAX_FOLLOW_UPS = 3

        const val GROUNDING =
            "This case is being written ahead of time for a pool of many candidates, not for one session — " +
                "nothing here is specific to a resume."
    }
}
