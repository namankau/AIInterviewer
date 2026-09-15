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

/** No live model call: `InterviewAi` is a stub throughout (CLAUDE.md rule 7). */
class CaseClientScenarioQuestionGeneratorTest {
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

    private fun cell() =
        PoolCell(
            id = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            runId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            coordinate =
                PoolCoordinate(
                    companyId = null,
                    archetype = Archetype.CONSULTING_BIG_FOUR,
                    roundType = RoundType.CASE_CLIENT_SCENARIO,
                    roleFamily = RoleFamily.BACKEND,
                    level = Level.SENIOR,
                ),
            companyName = null,
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    @Test
    fun `a well-formed case is passed through with its data and conclusion intact`() {
        val question =
            GeneratedQuestion(
                text = "A retailer's online revenue fell 12% quarter over quarter, from 40M to 35.2M. Walk me through it.",
                followUps = listOf("What would you check first?", "Say the drop is entirely mobile -- what changes?"),
                strongAnswerCovers =
                    listOf(
                        "segments the drop by channel before speculating",
                        "concludes with a specific next step, not just a diagnosis",
                    ),
            )
        val ai = ScriptedAi(listOf(question))
        val generator = CaseClientScenarioQuestionGenerator(ai)

        val result = generator.generate(PoolGenerationRequest(cell(), count = 1, avoid = emptyList(), knowledge = null))

        assertThat(result.value.questions).containsExactly(question)
        assertThat(ai.lastRequest?.roundGuidance).containsIgnoringCase("the numbers")
    }

    @Test
    fun `a malformed response with no strongAnswerCovers is still returned for the sanitiser to catch`() {
        val question =
            GeneratedQuestion(
                text = "A client's project is three weeks late. What do you do?",
                followUps = listOf("Who do you tell first?", "What do you tell the client?"),
                strongAnswerCovers = emptyList(),
            )
        val generator = CaseClientScenarioQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(PoolGenerationRequest(cell(), count = 1, avoid = emptyList(), knowledge = null))

        assertThat(
            result.value.questions
                .single()
                .strongAnswerCovers,
        ).isEmpty()
    }
}
