package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * The round the task calls out for level weighting: mostly `senior` and `staff`, sparse at
 * `entry`. [TechnoManagerialQuestionGenerator.weightedCount] is where that lives, and these
 * tests pin the exact fractions so a later change to them is a deliberate edit, not a
 * silent drift. No live model call: `InterviewAi` is a stub throughout (CLAUDE.md rule 7).
 */
class TechnoManagerialQuestionGeneratorTest {
    private class RecordingAi : StubPoolAi() {
        var lastRequest: PoolQuestionRequest? = null
            private set

        override fun generatePoolQuestions(request: PoolQuestionRequest): AiResult<GeneratedQuestions> {
            lastRequest = request
            val questions =
                (1..request.count).map { index ->
                    GeneratedQuestion(
                        text = "Question $index",
                        followUps = listOf("Follow-up A", "Follow-up B"),
                        strongAnswerCovers = listOf("a decision owned"),
                    )
                }
            return AiResult(GeneratedQuestions(questions), AiUsage("gemini-3.1-flash-lite", 100, 100))
        }
    }

    private fun cell(level: Level) =
        PoolCell(
            id = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            runId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            coordinate =
                PoolCoordinate(
                    companyId = null,
                    archetype = Archetype.INDIAN_PRODUCT,
                    roundType = RoundType.TECHNO_MANAGERIAL,
                    roleFamily = RoleFamily.BACKEND,
                    level = level,
                ),
            companyName = null,
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private fun askedCount(
        level: Level,
        requested: Int = 6,
    ): Int {
        val ai = RecordingAi()
        TechnoManagerialQuestionGenerator(ai)
            .generate(PoolGenerationRequest(cell(level), count = requested, avoid = emptyList(), knowledge = null))
        return ai.lastRequest!!.count
    }

    @Test
    fun `entry asks for a quarter of the batch, minimum one`() {
        assertThat(askedCount(Level.ENTRY, requested = 6)).isEqualTo(2)
        assertThat(askedCount(Level.ENTRY, requested = 2)).isEqualTo(1)
    }

    @Test
    fun `mid asks for two thirds of the batch`() {
        assertThat(askedCount(Level.MID, requested = 6)).isEqualTo(4)
    }

    @Test
    fun `senior and staff ask for the full batch`() {
        assertThat(askedCount(Level.SENIOR, requested = 6)).isEqualTo(6)
        assertThat(askedCount(Level.STAFF, requested = 6)).isEqualTo(6)
    }

    @Test
    fun `the response is passed through unchanged`() {
        val ai = RecordingAi()
        val result =
            TechnoManagerialQuestionGenerator(ai)
                .generate(PoolGenerationRequest(cell(Level.STAFF), count = 3, avoid = emptyList(), knowledge = null))

        assertThat(result.value.questions).hasSize(3)
    }
}
