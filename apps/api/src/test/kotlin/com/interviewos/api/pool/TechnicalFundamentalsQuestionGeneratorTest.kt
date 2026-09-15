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
class TechnicalFundamentalsQuestionGeneratorTest {
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

    private fun cell(
        roleFamily: RoleFamily,
        level: Level,
    ) = PoolCell(
        id = UUID.fromString("88888888-8888-8888-8888-888888888888"),
        runId = UUID.fromString("99999999-9999-9999-9999-999999999999"),
        coordinate =
            PoolCoordinate(
                companyId = null,
                archetype = Archetype.GLOBAL_PRODUCT,
                roundType = RoundType.TECHNICAL_FUNDAMENTALS,
                roleFamily = roleFamily,
                level = level,
            ),
        companyName = null,
        status = PoolCellStatus.IN_PROGRESS,
        attempts = 1,
    )

    private val wellFormed =
        GeneratedQuestion(
            text = "Why does normalisation cost you at read time?",
            followUps = listOf("When would you denormalise anyway?", "What breaks if you get it wrong?"),
            strongAnswerCovers = listOf("read/write trade-off", "a concrete failure mode"),
        )

    @Test
    fun `a well-formed response is passed through`() {
        val ai = ScriptedAi(listOf(wellFormed))
        val generator = TechnicalFundamentalsQuestionGenerator(ai)

        val result =
            generator.generate(
                PoolGenerationRequest(cell(RoleFamily.BACKEND, Level.STAFF), count = 2, avoid = emptyList(), knowledge = null),
            )

        assertThat(result.value.questions).containsExactly(wellFormed)
    }

    @Test
    fun `the guidance names the role family so ML fundamentals are not asked of a backend candidate`() {
        val ai = ScriptedAi(listOf(wellFormed))
        val generator = TechnicalFundamentalsQuestionGenerator(ai)

        generator.generate(
            PoolGenerationRequest(cell(RoleFamily.ML_AI, Level.MID), count = 2, avoid = emptyList(), knowledge = null),
        )

        val guidance = ai.lastRequest?.roundGuidance.orEmpty()
        assertThat(guidance).containsIgnoringCase("overfitting")
        assertThat(guidance).doesNotContain("SLIs")
    }

    @Test
    fun `depth guidance differs between entry and staff`() {
        val ai = ScriptedAi(listOf(wellFormed))
        val generator = TechnicalFundamentalsQuestionGenerator(ai)

        generator.generate(
            PoolGenerationRequest(cell(RoleFamily.SRE, Level.ENTRY), count = 2, avoid = emptyList(), knowledge = null),
        )
        val entryGuidance = ai.lastRequest?.roundGuidance.orEmpty()

        generator.generate(
            PoolGenerationRequest(cell(RoleFamily.SRE, Level.STAFF), count = 2, avoid = emptyList(), knowledge = null),
        )
        val staffGuidance = ai.lastRequest?.roundGuidance.orEmpty()

        assertThat(entryGuidance).containsIgnoringCase("Level: entry")
        assertThat(entryGuidance).doesNotContainIgnoringCase("failure modes")
        assertThat(staffGuidance).containsIgnoringCase("failure modes")
    }

    @Test
    fun `a malformed response with an empty text is still returned for the sanitiser to catch`() {
        val blank = wellFormed.copy(text = "")
        val ai = ScriptedAi(listOf(blank))
        val generator = TechnicalFundamentalsQuestionGenerator(ai)

        val result =
            generator.generate(
                PoolGenerationRequest(cell(RoleFamily.BACKEND, Level.MID), count = 1, avoid = emptyList(), knowledge = null),
            )

        assertThat(
            result.value.questions
                .single()
                .text,
        ).isEmpty()
    }
}
