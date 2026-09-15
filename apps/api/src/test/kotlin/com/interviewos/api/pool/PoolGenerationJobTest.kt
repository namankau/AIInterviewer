package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyList
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import java.time.Instant
import java.util.UUID

/**
 * The generation driver: resumability, the spend cap, and the provenance gate.
 *
 * **No live model call.** The AI boundary is a stub that counts what it was asked for, so
 * "the cap refused before the call" can be asserted as "the generator was never invoked"
 * rather than as a number after the fact (CLAUDE.md rule 7).
 */
class PoolGenerationJobTest {
    private val runId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    private val companyId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    private val cellId = UUID.fromString("44444444-4444-4444-4444-444444444444")

    private val runs = mock(PoolRunRepository::class.java)
    private val pool = mock(QuestionPoolRepository::class.java)

    private val properties =
        PoolProperties(
            enabled = true,
            concurrency = 1,
            questionsPerCell = 2,
            requestsPerMinute = 600,
            defaultSpendCapMicroUsd = 1_000_000,
            callHeadroomMicroUsd = 20_000,
        )

    private fun run(
        cap: Long = 1_000_000,
        status: PoolRunStatus = PoolRunStatus.PAUSED,
    ) = PoolRun(
        id = runId,
        startedAt = Instant.parse("2026-09-15T09:00:00Z"),
        finishedAt = null,
        status = status,
        generatorVersion = 1,
        spendCapMicroUsd = cap,
        spentMicroUsd = 0,
        note = null,
    )

    private fun cell() =
        PoolCell(
            id = cellId,
            runId = runId,
            coordinate =
                PoolCoordinate(
                    companyId = companyId,
                    archetype = Archetype.GLOBAL_PRODUCT,
                    roundType = RoundType.HR_FIT_CLOSING,
                    roleFamily = RoleFamily.BACKEND,
                    level = Level.MID,
                ),
            companyName = "Amazon",
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private fun progress(run: PoolRun) = PoolRunProgress(run, mapOf(PoolCellStatus.PENDING to 1), 0, 0)

    /** A generator that records whether it was asked for anything. */
    private class CountingGenerator(
        private val questions: List<GeneratedQuestion>,
        private val model: String = "gemini-3.1-flash-lite",
    ) : QuestionGenerator {
        var calls = 0
            private set
        var lastRequest: PoolGenerationRequest? = null
            private set

        override val roundType = RoundType.HR_FIT_CLOSING
        override val version = 7

        override fun generate(request: PoolGenerationRequest): AiResult<GeneratedQuestions> {
            calls++
            lastRequest = request
            return AiResult(GeneratedQuestions(questions), AiUsage(model, 100, 100))
        }
    }

    private fun knowledgeAi(
        knowledge: EmployerKnowledge,
        model: String = "gemini-3.1-flash-lite",
    ) = object : StubPoolAi() {
        var checks = 0

        override fun assessEmployerKnowledge(
            companyName: String,
            archetype: String,
        ): AiResult<EmployerKnowledge> {
            checks++
            return AiResult(knowledge, AiUsage(model, 50, 50))
        }
    }

    private fun question(
        text: String,
        companySpecific: Boolean = false,
    ) = GeneratedQuestion(
        text = text,
        followUps = listOf("Why that?", "What would you do differently?"),
        strongAnswerCovers = listOf("a concrete reason"),
        companySpecific = companySpecific,
    )

    private fun job(
        ai: StubPoolAi,
        generator: QuestionGenerator,
        props: PoolProperties = properties,
    ) = PoolGenerationJob(ai, props, runs, pool, PoolDeduplicator(ai, props), listOf(generator))

    @Test
    fun `with generation disabled it plans and pauses without calling anything`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = true))
        val generator = CountingGenerator(listOf(question("Why us?")))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))

        job(ai, generator, properties.copy(enabled = false)).run(runId)

        assertThat(generator.calls).isZero()
        assertThat(ai.checks).isZero()
        verify(runs, never()).claimNextCell(anyArg(), anyInt())
        verify(runs).updateStatus(eqArg(runId), eqArg(PoolRunStatus.PAUSED), any())
    }

    @Test
    fun `a cell is generated, deduplicated and written, and the cell is marked done`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false))
        val generator =
            CountingGenerator(listOf(question("Why this kind of company?"), question("Where next for you?")))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(cell(), null)
        given(pool.existingFor(anyArg())).willReturn(PoolDeduplicator.Existing(emptySet(), emptyList()))
        given(pool.embeddingsSupported).willReturn(false)
        given(pool.writeBatch(any(), anyList())).willReturn(2)

        job(ai, generator).run(runId)

        assertThat(generator.calls).isEqualTo(1)

        @Suppress("UNCHECKED_CAST")
        val written = ArgumentCaptor.forClass(List::class.java) as ArgumentCaptor<List<NewPoolQuestion>>
        verify(pool).writeBatch(eqArg(cellId), captureArg(written))
        val questions = written.value
        assertThat(questions).hasSize(2)
        assertThat(questions.map { it.model }).containsOnly("gemini-3.1-flash-lite")
        assertThat(questions.map { it.generatorVersion }).containsOnly(7)

        val outcome: ArgumentCaptor<PoolCellOutcome> = ArgumentCaptor.forClass(PoolCellOutcome::class.java)
        verify(runs).completeCell(eqArg(cellId), captureArg(outcome))
        assertThat(outcome.value.status).isEqualTo(PoolCellStatus.DONE)
        assertThat(outcome.value.questionsWritten).isEqualTo(2)
    }

    @Test
    fun `the cap refuses before the call, not after the money is gone`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false))
        val generator = CountingGenerator(listOf(question("Why us?")))
        given(runs.findRun(runId)).willReturn(run(cap = 100_000))
        given(runs.progress(anyArg())).willReturn(progress(run(cap = 100_000)))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(cell(), null)
        // 90,000 of 100,000 spent: there is money left, but not enough for another call.
        given(runs.spentOn(runId)).willReturn(90_000)

        job(ai, generator).run(runId)

        // The proof that the cap is a limit rather than a report: nothing was asked for.
        assertThat(generator.calls).isZero()
        assertThat(ai.checks).isZero()
        verify(pool, never()).writeBatch(any(), anyList())

        // And the cell was handed back untouched, so a resume picks it up as it was.
        val outcome: ArgumentCaptor<PoolCellOutcome> = ArgumentCaptor.forClass(PoolCellOutcome::class.java)
        verify(runs).completeCell(eqArg(cellId), captureArg(outcome))
        assertThat(outcome.value.status).isEqualTo(PoolCellStatus.PENDING)
        assertThat(outcome.value.questionsWritten).isZero()

        verify(runs).updateStatus(eqArg(runId), eqArg(PoolRunStatus.PAUSED), any())
    }

    @Test
    fun `a resume releases cells an earlier attempt left claimed before it takes any`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false))
        val generator = CountingGenerator(emptyList())
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(null)

        job(ai, generator).run(runId)

        // Without this a killed process leaves cells nobody will ever pick up, and the run
        // resumes, finds nothing pending, and calls itself finished with holes in it.
        verify(runs).releaseStaleCells(runId)
    }

    @Test
    fun `a company-specific claim the knowledge check did not earn is withdrawn on the way in`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false, basis = null))
        val generator = CountingGenerator(listOf(question("What draws you to Amazon?", companySpecific = true)))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(cell(), null)
        given(pool.existingFor(anyArg())).willReturn(PoolDeduplicator.Existing(emptySet(), emptyList()))
        given(pool.embeddingsSupported).willReturn(false)
        given(pool.writeBatch(any(), anyList())).willReturn(1)

        job(ai, generator).run(runId)

        @Suppress("UNCHECKED_CAST")
        val written = ArgumentCaptor.forClass(List::class.java) as ArgumentCaptor<List<NewPoolQuestion>>
        verify(pool).writeBatch(eqArg(cellId), captureArg(written))
        val questions = written.value
        assertThat(questions.single().association).isEqualTo(Association.EMPLOYER_KIND)

        val outcome: ArgumentCaptor<PoolCellOutcome> = ArgumentCaptor.forClass(PoolCellOutcome::class.java)
        verify(runs).completeCell(eqArg(cellId), captureArg(outcome))
        // Counted, because a generator whose claims are withdrawn every time is a
        // generator with a broken prompt and nothing else would say so.
        assertThat(outcome.value.downgraded).isEqualTo(1)
    }

    @Test
    fun `a claim the knowledge check did earn survives`() {
        val ai =
            knowledgeAi(
                EmployerKnowledge(
                    knowsProcess = true,
                    basis = "Their published loop names a bar raiser round and their leadership principles.",
                    namedRounds = listOf("bar raiser"),
                ),
            )
        val generator = CountingGenerator(listOf(question("Tell me about a time you were the bar raiser.", true)))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(cell(), null)
        given(pool.existingFor(anyArg())).willReturn(PoolDeduplicator.Existing(emptySet(), emptyList()))
        given(pool.embeddingsSupported).willReturn(false)
        given(pool.writeBatch(any(), anyList())).willReturn(1)

        job(ai, generator).run(runId)

        @Suppress("UNCHECKED_CAST")
        val written = ArgumentCaptor.forClass(List::class.java) as ArgumentCaptor<List<NewPoolQuestion>>
        verify(pool).writeBatch(eqArg(cellId), captureArg(written))
        val questions = written.value
        assertThat(questions.single().association).isEqualTo(Association.COMPANY_SPECIFIC)
        // The database refuses a company-specific row with no account behind it, and so
        // does this: the evidence travels with the label.
        assertThat(questions.single().knowledgeBasis).isNotBlank()
    }

    @Test
    fun `a round type nothing generates for is skipped rather than failed`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false))
        val generator = CountingGenerator(emptyList())
        val systemDesign =
            cell().copy(coordinate = cell().coordinate.copy(roundType = RoundType.SYSTEM_DESIGN))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(systemDesign, null)

        job(ai, generator).run(runId)

        val outcome: ArgumentCaptor<PoolCellOutcome> = ArgumentCaptor.forClass(PoolCellOutcome::class.java)
        verify(runs).completeCell(eqArg(cellId), captureArg(outcome))
        assertThat(outcome.value.status).isEqualTo(PoolCellStatus.SKIPPED)
        assertThat(generator.calls).isZero()
    }

    @Test
    fun `the employer is asked about once, however many cells it has`() {
        val ai = knowledgeAi(EmployerKnowledge(knowsProcess = false))
        val generator = CountingGenerator(listOf(question("Why this kind of company?")))
        val second = cell().copy(coordinate = cell().coordinate.copy(level = Level.SENIOR))
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress(run()))
        given(runs.claimNextCell(runId, properties.maxAttemptsPerCell)).willReturn(cell(), second, null)
        given(pool.existingFor(anyArg())).willReturn(PoolDeduplicator.Existing(emptySet(), emptyList()))
        given(pool.embeddingsSupported).willReturn(false)
        given(pool.writeBatch(any(), anyList())).willReturn(1)

        job(ai, generator).run(runId)

        assertThat(generator.calls).isEqualTo(2)
        // Twenty-eight cells per company would otherwise be twenty-seven wasted calls and
        // twenty-seven chances for one employer to get two provenance stories in one run.
        assertThat(ai.checks).isEqualTo(1)
    }
}
