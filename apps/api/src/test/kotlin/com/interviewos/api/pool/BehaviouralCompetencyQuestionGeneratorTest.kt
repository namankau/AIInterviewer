package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

/**
 * The generator most likely to attribute an invented value to a real employer, so it is the
 * one CLAUDE.md's rule against that gets a test proving it directly, independent of
 * [PoolAssociationGate] (which catches only the coarser "no knowledge at all" case).
 *
 * **No live model call.** Every case here hands the generator a canned [GeneratedQuestions]
 * through a stub `InterviewAi` (CLAUDE.md rule 7).
 */
class BehaviouralCompetencyQuestionGeneratorTest {
    private fun cell(companyName: String? = "Amazon") =
        PoolCell(
            id = UUID.fromString("55555555-5555-5555-5555-555555555555"),
            runId = UUID.fromString("66666666-6666-6666-6666-666666666666"),
            coordinate =
                PoolCoordinate(
                    companyId = if (companyName != null) UUID.fromString("77777777-7777-7777-7777-777777777777") else null,
                    archetype = Archetype.GLOBAL_PRODUCT,
                    roundType = RoundType.BEHAVIOURAL_COMPETENCY,
                    roleFamily = RoleFamily.BACKEND,
                    level = Level.MID,
                ),
            companyName = companyName,
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private fun request(
        knowledge: EmployerKnowledge?,
        companyName: String? = "Amazon",
    ) = PoolGenerationRequest(cell = cell(companyName), count = 2, avoid = emptyList(), knowledge = knowledge)

    /** Returns exactly the questions it is given, so a test controls the model's answer precisely. */
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

    @Test
    fun `a well-formed response with a licensed value is passed through unchanged`() {
        val knowledge = EmployerKnowledge(knowsProcess = true, basis = "Public LP list.", namedValues = listOf("Customer Obsession"))
        val question =
            GeneratedQuestion(
                text = "Tell me about a time you obsessed over a customer's problem.",
                followUps = listOf("What did you personally change?", "What was the measurable result?"),
                strongAnswerCovers = listOf("a specific customer, a specific change"),
                companySpecific = true,
                valueClaimed = "Customer Obsession",
            )
        val generator = BehaviouralCompetencyQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(request(knowledge))

        assertThat(
            result.value.questions
                .single()
                .companySpecific,
        ).isTrue()
        assertThat(
            result.value.questions
                .single()
                .valueClaimed,
        ).isEqualTo("Customer Obsession")
    }

    @Test
    fun `a malformed response with no follow-ups is still passed through for the job to reject`() {
        // The generator does not itself enforce follow-up count -- the database constraint
        // and PoolQuestionSanitiser do -- but it must not silently drop or crash on a
        // response the schema technically allowed through with an empty list.
        val question =
            GeneratedQuestion(
                text = "Tell me about a disagreement.",
                followUps = emptyList(),
                strongAnswerCovers = emptyList(),
                companySpecific = false,
            )
        val generator = BehaviouralCompetencyQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(request(knowledge = null, companyName = null))

        assertThat(result.value.questions).hasSize(1)
        assertThat(
            result.value.questions
                .single()
                .followUps,
        ).isEmpty()
    }

    @Test
    fun `a question claiming a value the knowledge check never named is downgraded`() {
        // The knowledge check licensed "Customer Obsession" only. The model writes a
        // question around "Bias for Speed" -- a plausible-sounding Amazon-flavoured name
        // that was never named. This is exactly the fabricated-leadership-principle failure
        // CLAUDE.md calls the most damaging this product has, and PoolAssociationGate's own
        // check (knows the employer at all, named something) would not catch it because the
        // employer genuinely is known and something genuinely was named -- just not this.
        val knowledge = EmployerKnowledge(knowsProcess = true, basis = "Public LP list.", namedValues = listOf("Customer Obsession"))
        val question =
            GeneratedQuestion(
                text = "Tell me about a time you showed Bias for Speed.",
                followUps = listOf("What did you personally decide?", "What would you do differently?"),
                strongAnswerCovers = listOf("a concrete decision"),
                companySpecific = true,
                valueClaimed = "Bias for Speed",
            )
        val generator = BehaviouralCompetencyQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(request(knowledge))

        val written = result.value.questions.single()
        assertThat(written.companySpecific).isFalse()
        assertThat(written.valueClaimed).isNull()
    }

    @Test
    fun `a claim with no named value at all is never given the benefit of the doubt`() {
        val knowledge = EmployerKnowledge(knowsProcess = true, basis = "Public LP list.", namedValues = listOf("Ownership"))
        val question =
            GeneratedQuestion(
                text = "Tell me about a time you took ownership.",
                followUps = listOf("What did you personally decide?", "What would you do differently?"),
                strongAnswerCovers = listOf("a concrete decision"),
                companySpecific = true,
                valueClaimed = null,
            )
        val generator = BehaviouralCompetencyQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(request(knowledge))

        assertThat(
            result.value.questions
                .single()
                .companySpecific,
        ).isFalse()
    }

    @Test
    fun `matching is case- and whitespace-insensitive but still exact about which value`() {
        val knowledge = EmployerKnowledge(knowsProcess = true, basis = "Public LP list.", namedValues = listOf("Customer Obsession"))
        val question =
            GeneratedQuestion(
                text = "Tell me about a time you obsessed over a customer's problem.",
                followUps = listOf("What did you personally change?", "What was the result?"),
                strongAnswerCovers = listOf("a specific customer"),
                companySpecific = true,
                valueClaimed = "  customer obsession  ",
            )
        val generator = BehaviouralCompetencyQuestionGenerator(ScriptedAi(listOf(question)))

        val result = generator.generate(request(knowledge))

        assertThat(
            result.value.questions
                .single()
                .companySpecific,
        ).isTrue()
    }
}
