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
 * Task 041's extension of 039's reference generator: the guidance now varies by employer
 * archetype. No live model call: `InterviewAi` is a stub throughout (CLAUDE.md rule 7).
 */
class HrFitQuestionGeneratorTest {
    private class ScriptedAi(
        private val questions: List<GeneratedQuestion>,
    ) : StubPoolAi() {
        var lastRequest: PoolQuestionRequest? = null
            private set

        override fun generatePoolQuestions(request: PoolQuestionRequest): AiResult<GeneratedQuestions> {
            lastRequest = request
            return AiResult(GeneratedQuestions(questions), AiUsage("gemini-3.1-flash-lite", 100, 100))
        }
    }

    private fun cell(archetype: Archetype) =
        PoolCell(
            id = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            runId = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            coordinate =
                PoolCoordinate(
                    companyId = null,
                    archetype = archetype,
                    roundType = RoundType.HR_FIT_CLOSING,
                    roleFamily = RoleFamily.BACKEND,
                    level = Level.MID,
                ),
            companyName = null,
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private val wellFormed =
        GeneratedQuestion(
            text = "What is your notice period, and how firm is it?",
            followUps = listOf("Could it be shortened?", "Would a counter-offer change it?"),
            strongAnswerCovers = listOf("a specific number of weeks"),
        )

    @Test
    fun `version is bumped for the archetype-aware guidance`() {
        assertThat(HrFitQuestionGenerator(ScriptedAi(emptyList())).version).isEqualTo(2)
    }

    @Test
    fun `a service-based IT firm's guidance is not the same as a global product company's`() {
        val ai = ScriptedAi(listOf(wellFormed))
        val generator = HrFitQuestionGenerator(ai)

        generator.generate(
            PoolGenerationRequest(cell(Archetype.SERVICE_BASED_IT), count = 1, avoid = emptyList(), knowledge = null),
        )
        val serviceGuidance = ai.lastRequest?.roundGuidance.orEmpty()

        generator.generate(
            PoolGenerationRequest(cell(Archetype.GLOBAL_PRODUCT), count = 1, avoid = emptyList(), knowledge = null),
        )
        val productGuidance = ai.lastRequest?.roundGuidance.orEmpty()

        assertThat(serviceGuidance).containsIgnoringCase("bond")
        assertThat(productGuidance).doesNotContainIgnoringCase("bond")
        assertThat(serviceGuidance).isNotEqualTo(productGuidance)
    }

    @Test
    fun `a well-formed response is passed through`() {
        val generator = HrFitQuestionGenerator(ScriptedAi(listOf(wellFormed)))

        val result =
            generator.generate(
                PoolGenerationRequest(cell(Archetype.EUROPEAN_EMPLOYER), count = 1, avoid = emptyList(), knowledge = null),
            )

        assertThat(result.value.questions).containsExactly(wellFormed)
    }
}
