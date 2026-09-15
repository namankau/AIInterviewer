package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * Techno-managerial, task 041 (PRD §08, §09).
 *
 * The round that decides between doing and leading, which is mostly a `senior` and `staff`
 * question. A fresh graduate has not yet run an estimate someone else had to live with or
 * escalated a slipping plan, so a full batch of these questions at `entry` would be asking
 * the pool to hold a lot of nearly-identical, low-signal rows for a level that rarely runs
 * this round for real. [weightedCount] is the whole of that decision: it scales how many
 * questions are asked for, by level, rather than the round being generated or skipped
 * wholesale — `entry` still gets some coverage, because the round type exists in the round
 * type list a run can be planned for, and a coordinate with zero rows is indistinguishable
 * from one nobody tried.
 *
 * Weighting: `entry` a quarter of the cell's normal batch (minimum one), `mid` two thirds,
 * `senior` and `staff` the full batch asked for.
 */
@Component
class TechnoManagerialQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.TECHNO_MANAGERIAL

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
                count = weightedCount(request.count, request.cell.coordinate.level),
                avoid = request.avoid,
                knowledge = request.knowledge,
            ),
        )

    private fun weightedCount(
        requested: Int,
        level: Level,
    ): Int {
        val fraction =
            when (level) {
                Level.ENTRY -> 0.25
                Level.MID -> 0.67
                Level.SENIOR, Level.STAFF -> 1.0
            }
        return min(requested, max(1, ceil(requested * fraction).toInt()))
    }

    private fun guidance(): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append(
                "\n\nThis is a leading-versus-doing round, not a second technical round: ask about the " +
                    "decision, not the implementation underneath it. A strong question puts the candidate in " +
                    "front of a constraint someone else now has to live with — a commitment they made, a call " +
                    "they made under pressure, a trade-off they own the consequences of — and the follow-ups " +
                    "press on how they decided, not just what happened.",
            )
        }
}
