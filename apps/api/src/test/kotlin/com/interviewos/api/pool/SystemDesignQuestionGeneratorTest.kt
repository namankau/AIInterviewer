package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

/**
 * The `system_design` pool generator: which tag it chooses, what it writes when
 * `composeCase` comes back malformed, and that it never claims company specificity.
 *
 * **No live model call**: [InterviewAi] is mocked at the boundary (CLAUDE.md rule 7).
 */
class SystemDesignQuestionGeneratorTest {
    private val ai: InterviewAi = mock(InterviewAi::class.java)
    private val mapper = JsonMapper.builder().build()
    private val generator = SystemDesignQuestionGenerator(ai, mapper)

    private fun cell(level: Level) =
        PoolCell(
            id = UUID.fromString("11111111-1111-1111-1111-111111111111"),
            runId = UUID.fromString("22222222-2222-2222-2222-222222222222"),
            coordinate =
                PoolCoordinate(
                    companyId = UUID.fromString("33333333-3333-3333-3333-333333333333"),
                    archetype = Archetype.GLOBAL_PRODUCT,
                    roundType = RoundType.SYSTEM_DESIGN,
                    roleFamily = RoleFamily.BACKEND,
                    level = level,
                ),
            companyName = "Netflix",
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private fun request(
        level: Level,
        knowledge: EmployerKnowledge? = null,
    ) = PoolGenerationRequest(cell = cell(level), count = 6, avoid = listOf("An earlier rate-limiter case"), knowledge = knowledge)

    private fun wellFormedCase() =
        ComposedCase(
            title = "Design a job scheduler",
            summary = "Fairness across tenants under a fixed worker pool.",
            constraints = listOf("10k jobs/min", "p99 dispatch < 500ms", "3 priority tiers"),
            openingPrompt = "You're building a scheduler for background jobs. What does it need to do?",
            deepDiveOptions = listOf("starvation under priority", "retry and backoff", "worker failure mid-job"),
        )

    private fun stub(
        case: ComposedCase,
        usage: AiUsage = AiUsage("gemini-3.1-flash-lite", 400, 400),
    ) {
        given(ai.composeCase(anyArg(), anyInt())).willReturn(AiResult(case, usage))
    }

    @Test
    fun `entry and mid cells are tagged machine-coding`() {
        stub(wellFormedCase())

        val entry =
            generator
                .generate(request(Level.ENTRY))
                .value.questions
                .single()
        val mid =
            generator
                .generate(request(Level.MID))
                .value.questions
                .single()

        assertThat(entry.payload!!.path("designTag").asText()).isEqualTo("machine_coding")
        assertThat(mid.payload!!.path("designTag").asText()).isEqualTo("machine_coding")
    }

    @Test
    fun `senior and staff cells are tagged distributed design`() {
        stub(wellFormedCase())

        val senior =
            generator
                .generate(request(Level.SENIOR))
                .value.questions
                .single()
        val staff =
            generator
                .generate(request(Level.STAFF))
                .value.questions
                .single()

        assertThat(senior.payload!!.path("designTag").asText()).isEqualTo("distributed_design")
        assertThat(staff.payload!!.path("designTag").asText()).isEqualTo("distributed_design")
    }

    @Test
    fun `a well-formed case is written with its deep-dives as follow-ups and never claims company specificity`() {
        stub(wellFormedCase())

        val result =
            generator.generate(
                request(knowledge = EmployerKnowledge(knowsProcess = true, basis = "Their loop."), level = Level.STAFF),
            )

        assertThat(result.value.questions).hasSize(1)
        val question = result.value.questions.single()
        assertThat(question.text).isEqualTo("You're building a scheduler for background jobs. What does it need to do?")
        assertThat(question.followUps).isEqualTo(listOf("starvation under priority", "retry and backoff", "worker failure mid-job"))
        assertThat(question.companySpecific).isFalse()

        val payload = question.payload!!
        assertThat(payload.path("kind").asText()).isEqualTo("system_design")
        assertThat(payload.path("title").asText()).isEqualTo("Design a job scheduler")
        assertThat(payload.path("constraints")).hasSize(3)
        assertThat(payload.path("weakAnswerMisses").isArray).isTrue()
        assertThat(payload.path("weakAnswerMisses")).isNotEmpty()
    }

    @Test
    fun `a case missing its opening prompt is treated as malformed and nothing is written`() {
        stub(wellFormedCase().copy(openingPrompt = ""))

        val result = generator.generate(request(Level.MID))

        assertThat(result.value.questions).isEmpty()
    }

    @Test
    fun `a case with no deep-dive options is treated as malformed and nothing is written`() {
        stub(wellFormedCase().copy(deepDiveOptions = emptyList()))

        val result = generator.generate(request(Level.SENIOR))

        assertThat(result.value.questions).isEmpty()
    }

    @Test
    fun `a case with no constraints is treated as malformed and nothing is written`() {
        stub(wellFormedCase().copy(constraints = emptyList()))

        val result = generator.generate(request(Level.ENTRY))

        assertThat(result.value.questions).isEmpty()
    }

    @Test
    fun `machine-coding and distributed-design cells are steered differently, and each avoids what was already used`() {
        var machineCodingBrief: InterviewBrief? = null
        var distributedBrief: InterviewBrief? = null
        given(ai.composeCase(anyArg(), anyInt())).willAnswer { invocation ->
            val brief: InterviewBrief = invocation.getArgument(0)
            if (machineCodingBrief == null) machineCodingBrief = brief else distributedBrief = brief
            AiResult(wellFormedCase(), AiUsage("gemini-3.1-flash-lite", 400, 400))
        }

        generator.generate(request(Level.ENTRY))
        generator.generate(request(Level.STAFF))

        assertThat(machineCodingBrief!!.roundCovers).contains("machine-coding")
        assertThat(distributedBrief!!.roundCovers).contains("distributed-systems")
        assertThat(machineCodingBrief!!.roundCovers).contains("An earlier rate-limiter case")
    }

    @Test
    fun `the employer's name is never sent when the cell has no company`() {
        val archetypeCell = cell(Level.MID).copy(coordinate = cell(Level.MID).coordinate.copy(companyId = null), companyName = null)
        var capturedBrief: InterviewBrief? = null
        given(ai.composeCase(anyArg(), anyInt())).willAnswer { invocation ->
            capturedBrief = invocation.getArgument(0)
            AiResult(wellFormedCase(), AiUsage("gemini-3.1-flash-lite", 400, 400))
        }

        generator.generate(PoolGenerationRequest(cell = archetypeCell, count = 6, avoid = emptyList(), knowledge = null))

        assertThat(capturedBrief?.company).doesNotContain("Netflix")
    }
}
