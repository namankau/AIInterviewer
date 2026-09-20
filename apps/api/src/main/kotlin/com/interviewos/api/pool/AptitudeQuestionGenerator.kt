package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * The pool's `aptitude` generator (task 048).
 *
 * Aptitude is where most Indian campus candidates are eliminated, and until now this
 * product had no round for it at all. The material is generated rather than ingested
 * because there is no openly-licensed aptitude corpus to ingest: the sets that exist are
 * either proprietary prep content or non-commercial-licensed, and scraping is out of scope
 * by decision (CLAUDE.md). Generated questions are model knowledge and are labelled as such
 * by the engine, like every other pool row.
 *
 * **Nothing here describes any employer's test.** No duration, no section count, no cut-off,
 * no named assessment. Every figure in circulation about those traces to prep aggregators
 * rather than to the employer, so the guidance stays at the level of what this kind of
 * hiring process typically contains — which is what the product is allowed to say and, for
 * a candidate preparing, the part that is actually stable.
 *
 * The four areas are named in the guidance rather than rotated by a mechanism of their own:
 * one cell's batch is written in a single call, so asking that call to spread itself across
 * the areas is both cheaper and more reliable than four calls that cannot see each other.
 */
@Component
class AptitudeQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.APTITUDE

    override val version: Int = 1

    override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> =
        ai.generatePoolQuestions(
            PoolQuestionRequest(
                companyName = request.cell.companyName,
                archetype = request.cell.coordinate.archetype.label,
                roundType = roundType.label,
                roleFamily = request.cell.coordinate.roleFamily.label,
                level = request.cell.coordinate.level.label,
                roundGuidance = guidance(request.cell.coordinate.archetype, request.cell.coordinate.level),
                count = request.count,
                avoid = request.avoid,
                knowledge = request.knowledge,
            ),
        )

    private fun guidance(
        archetype: Archetype,
        level: Level,
    ): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append("\n\n")
            append(SPOKEN_RULES)
            append("\n\nSpread this batch across the four areas rather than writing four of one:\n")
            append(AREAS.joinToString("\n") { "- $it" })
            append("\n\n")
            append(levelFocus(level))
            append("\n\n")
            append(archetypeEmphasis(archetype))
        }

    /**
     * What makes an aptitude question answerable out loud.
     *
     * The failure this prevents is a question copied out of a written test: five options,
     * three decimal places, and a number nobody can hold in their head. Read aloud it is
     * unanswerable, and the candidate learns that our interviewer does not know what a
     * spoken round is.
     */
    private fun levelFocus(level: Level): String =
        when (level) {
            Level.ENTRY -> {
                "Level: entry. This is campus and new-graduate hiring, where a reasoning gate of this kind " +
                    "usually comes before any technical round. Stay on the ground a final-year student has " +
                    "actually practised: percentages, ratios, time and work, speed and distance, simple " +
                    "probability, series, syllogisms, seating and ordering puzzles, and reading a small table."
            }

            Level.MID -> {
                "Level: mid. Keep the reasoning, drop the exam flavour. Prefer problems that look like work: " +
                    "sizing a change before making it, reading a metric that moved, deciding whether a number " +
                    "somebody quoted can possibly be right."
            }

            Level.SENIOR, Level.STAFF -> {
                "Level: senior. A round of this kind is rare above entry level, so write the version that " +
                    "would still be worth asking: an estimate under uncertainty, where the assumptions stated " +
                    "out loud are the whole answer and the arithmetic is deliberately easy."
            }
        }

    /** What this round is for at one kind of employer, at the level of the kind and never the company. */
    private fun archetypeEmphasis(archetype: Archetype): String =
        when (archetype) {
            Archetype.SERVICE_BASED_IT, Archetype.CONSULTING_BIG_FOUR -> {
                "This is ${archetype.inProse}, where hiring runs at volume and a reasoning gate typically " +
                    "sits early in the process. Weight the batch toward speed and accuracy under a clock the " +
                    "candidate can feel, and toward verbal reasoning, because this kind of hiring tends to " +
                    "test how clearly somebody can be understood as well as what they can work out."
            }

            Archetype.GCC_CAPTIVE, Archetype.INDUSTRIAL_MANUFACTURING, Archetype.REGULATED_PROFESSIONAL -> {
                "This is ${archetype.inProse}. Weight the batch toward careful, checkable reasoning — a wrong " +
                    "number noticed and corrected is worth more here than a fast one asserted."
            }

            Archetype.GLOBAL_PRODUCT, Archetype.INDIAN_PRODUCT, Archetype.EUROPEAN_EMPLOYER -> {
                "This is ${archetype.inProse}. A standalone aptitude gate is less usual here, so write " +
                    "problems that would be asked inside a technical conversation: estimation, orders of " +
                    "magnitude, and whether a quoted number is plausible at all."
            }
        }

    private companion object {
        val AREAS =
            listOf(
                "quantitative: arithmetic, ratios and rates, work and time, simple probability",
                "logical reasoning: deduction, sequences, arrangements, what does and does not follow",
                "data interpretation: a handful of figures, read aloud, with one conclusion drawn from them",
                "verbal ability: precision of language — what a sentence actually claims, and what it leaves open",
            )

        val SPOKEN_RULES =
            """
            **This round is spoken, and the candidate has nothing to write on.** Every question must therefore:

            - be answerable in two or three minutes of talking, out loud, with no scratch paper;
            - carry numbers a person can hold in their head — round figures, not 17.3% of 2,847;
            - have **no multiple-choice options**. The answer we want is the method, and options let somebody
              work backwards from them;
            - be fully stated in speech. A question that needs a diagram, a grid on the page or a long table
              read out is not a question in this round, however good it is on paper;
            - be worth explaining. If the only thing a strong answer contains is the final number, it is the
              wrong question here.

            Write `strongAnswerCovers` as the steps of the reasoning, in order, so the interviewer can tell a
            candidate who worked it out from one who remembered the answer.
            """.trimIndent()
    }
}
