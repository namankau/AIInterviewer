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
 * The aptitude generator (task 048). No live model call: `InterviewAi` is a stub
 * throughout (CLAUDE.md rule 7).
 *
 * Two things are worth holding here. The round is **spoken**, so a question copied out of
 * a written test — options, a grid, three decimal places — is the failure mode, and the
 * guidance has to rule it out in words. And the guidance must claim nothing about any
 * employer's test: no duration, no section count, no named assessment, because every such
 * figure in circulation comes from a prep aggregator rather than from the employer.
 */
class AptitudeQuestionGeneratorTest {
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

    private val wellFormed =
        GeneratedQuestion(
            text = "A train covers 180 km in three hours. How much longer does the same trip take at two thirds the speed?",
            followUps = listOf("What if it stopped for twenty minutes?", "How would you sanity-check that answer?"),
            strongAnswerCovers = listOf("finds the original speed first", "recognises time scales inversely with speed"),
        )

    private fun cell(
        archetype: Archetype = Archetype.SERVICE_BASED_IT,
        level: Level = Level.ENTRY,
    ) = PoolCell(
        id = UUID.fromString("88888888-8888-8888-8888-888888888801"),
        runId = UUID.fromString("99999999-9999-9999-9999-999999999901"),
        coordinate =
            PoolCoordinate(
                companyId = null,
                archetype = archetype,
                roundType = RoundType.APTITUDE,
                roleFamily = RoleFamily.BACKEND,
                level = level,
            ),
        companyName = null,
        status = PoolCellStatus.IN_PROGRESS,
        attempts = 1,
    )

    private fun generate(
        archetype: Archetype = Archetype.SERVICE_BASED_IT,
        level: Level = Level.ENTRY,
        ai: ScriptedAi = ScriptedAi(listOf(wellFormed)),
    ): ScriptedAi {
        AptitudeQuestionGenerator(ai).generate(
            PoolGenerationRequest(cell(archetype, level), count = 4, avoid = emptyList(), knowledge = null),
        )
        return ai
    }

    @Test
    fun `a well-formed response is passed through`() {
        val ai = ScriptedAi(listOf(wellFormed))

        val result =
            AptitudeQuestionGenerator(ai).generate(
                PoolGenerationRequest(cell(), count = 4, avoid = emptyList(), knowledge = null),
            )

        assertThat(result.value.questions).containsExactly(wellFormed)
    }

    @Test
    fun `the guidance rules out a question that only works on paper`() {
        val guidance = generate().lastRequest?.roundGuidance.orEmpty()

        assertThat(guidance).contains("no scratch paper")
        assertThat(guidance).contains("**no multiple-choice options**")
        assertThat(guidance).contains("needs a diagram")
    }

    @Test
    fun `all four areas are asked for, so a batch is not four of one`() {
        val guidance = generate().lastRequest?.roundGuidance.orEmpty()

        for (area in listOf("quantitative", "logical reasoning", "data interpretation", "verbal ability")) {
            assertThat(guidance).containsIgnoringCase(area)
        }
    }

    @Test
    fun `entry level gets the ground a student has actually practised, and senior does not`() {
        val entry = generate(level = Level.ENTRY).lastRequest?.roundGuidance.orEmpty()
        val senior = generate(level = Level.SENIOR).lastRequest?.roundGuidance.orEmpty()

        assertThat(entry).containsIgnoringCase("syllogisms")
        assertThat(senior).doesNotContainIgnoringCase("syllogisms")
        assertThat(senior).containsIgnoringCase("estimate under uncertainty")
    }

    /**
     * The provenance rule this task turns on. An aptitude round is the place a model would
     * most happily produce "the test is 90 minutes and has three sections" — every such
     * number traces to a prep aggregator, not to the employer, so none of it is in the
     * guidance at any level or for any archetype.
     */
    @Test
    fun `the guidance claims nothing about any employer's test`() {
        val invented =
            listOf(
                "NQT",
                "InfyTQ",
                "HackWithInfy",
                "GenC",
                "Elite National",
                // The shape of a real test, as opposed to the shape of a question. Every
                // figure in circulation for these comes from a prep aggregator.
                "section",
                "cut-off",
                "cutoff",
                "negative marking",
                "question paper",
                "marks",
                "TCS",
                "Infosys",
                "Wipro",
                "Cognizant",
                "Accenture",
                "Capgemini",
            )

        for (archetype in Archetype.entries) {
            for (level in Level.entries) {
                val guidance =
                    generate(archetype = archetype, level = level).lastRequest?.roundGuidance.orEmpty()

                for (phrase in invented) {
                    assertThat(guidance)
                        .withFailMessage("%s/%s names '%s': %s", archetype.dbValue, level.dbValue, phrase, guidance)
                        .doesNotContainIgnoringCase(phrase)
                }
            }
        }
    }

    @Test
    fun `an archetype that does not usually run a standalone aptitude gate is told so`() {
        val product = generate(archetype = Archetype.GLOBAL_PRODUCT).lastRequest?.roundGuidance.orEmpty()
        val services = generate(archetype = Archetype.SERVICE_BASED_IT).lastRequest?.roundGuidance.orEmpty()

        assertThat(product).containsIgnoringCase("less usual here")
        assertThat(services).containsIgnoringCase("hiring runs at volume")
    }

    @Test
    fun `a malformed response is still returned for the sanitiser to catch`() {
        val ai = ScriptedAi(listOf(wellFormed.copy(text = "")))

        val result =
            AptitudeQuestionGenerator(ai).generate(
                PoolGenerationRequest(cell(), count = 1, avoid = emptyList(), knowledge = null),
            )

        assertThat(
            result.value.questions
                .single()
                .text,
        ).isEmpty()
    }
}
