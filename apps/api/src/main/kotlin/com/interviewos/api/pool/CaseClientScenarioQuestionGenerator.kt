package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.RoundType
import org.springframework.stereotype.Component

/**
 * Case and client scenario, task 041 (PRD §08, §09).
 *
 * Consulting-flavoured rounds and non-engineering corporate functions, both under-served by
 * the competitors this product measures itself against. A pool case is a self-contained
 * scenario: this generator does not get a separate field for "the data" and "the
 * conclusion" — [GeneratedQuestion.text][com.interviewos.api.ai.GeneratedQuestion] carries
 * the whole case (the situation and the numbers a candidate is given to work with), and
 * `strongAnswerCovers` carries the structuring points and the recommendation a strong answer
 * would actually land on, so both are things a report can check an answer against rather
 * than prose nobody can score.
 */
@Component
class CaseClientScenarioQuestionGenerator(
    private val ai: InterviewAi,
) : QuestionGenerator {
    override val roundType: RoundType = RoundType.CASE_CLIENT_SCENARIO

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

    private fun guidance(): String =
        buildString {
            append(roundType.brief)
            append("\n\nGround this round has to get across:\n")
            append(roundType.covers.joinToString("\n") { "- $it" })
            append(
                "\n\nWrite each `text` as a complete case brief the interviewer reads out in one go: the client " +
                    "or business situation, and the specific data the candidate is given to reason with (figures, " +
                    "constraints, a stated objective) — enough that a candidate with nothing else could start " +
                    "structuring an answer. Do not write 'the interviewer will provide numbers on request'; " +
                    "write the numbers.\n\n" +
                    "`strongAnswerCovers` is the structuring a strong candidate imposes (segmenting the problem, " +
                    "stating assumptions explicitly, sizing something aloud) and the recommendation their " +
                    "analysis of the given data should actually conclude — not a restatement of the prompt. " +
                    "`followUps` escalate the scenario once the candidate is comfortable with the base case, per " +
                    "the round's own brief above.",
            )
        }
}
