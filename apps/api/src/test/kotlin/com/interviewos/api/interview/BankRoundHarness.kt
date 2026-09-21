package com.interviewos.api.interview

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.ComposedRound
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.QuestionBankRepository
import com.interviewos.api.pool.PoolQuestion
import com.interviewos.api.pool.QuestionPoolRepository
import com.interviewos.api.pool.RoleFamily
import com.interviewos.api.resume.ResumeService
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.UserRepository
import org.mockito.BDDMockito.given
import org.mockito.Mockito.RETURNS_DEFAULTS
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockingDetails
import org.springframework.core.task.SyncTaskExecutor
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.util.UUID

/**
 * A real [InterviewService] over mocks at every boundary — the database, the bank, the
 * model — so a round can be run end to end without a network.
 *
 * The model is a Mockito mock with a scripted default answer rather than a hand-written
 * fake, so a method added to [InterviewAi] later does not break this harness.
 */
class BankRoundHarness {
    val mapper: JsonMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    val repository: SessionRepository = mock(SessionRepository::class.java)
    val directory: CompanyDirectory = mock(CompanyDirectory::class.java)
    val bank: QuestionBankRepository = mock(QuestionBankRepository::class.java)
    val pool: QuestionPoolRepository = mock(QuestionPoolRepository::class.java)
    val archetypes = ArchetypeResolver()
    val poolMaterial = PoolMaterial(mapper)

    /** Returns null for every candidate unless a test says otherwise: no resume, as most rounds run. */
    val resumeService: ResumeService = mock(ResumeService::class.java)

    /** What the model is asked, in order. */
    val briefs = mutableListOf<InterviewBrief>()
    var case: ComposedCase? = null
    var assessment: AnswerAssessment? = null
    var report: ReportContent? = null

    /** What the model reads out of a candidate's one-line query, when a test exercises the round composer. */
    var composedRound: ComposedRound? = null

    val ai: InterviewAi =
        mock(InterviewAi::class.java) { invocation ->
            val brief = invocation.arguments.firstOrNull() as? InterviewBrief
            brief?.let { briefs += it }
            when (invocation.method.name) {
                "composeCase" -> AiResult(checkNotNull(case), AiUsage.none("test"))
                "composeRound" -> AiResult(checkNotNull(composedRound), AiUsage.none("test"))
                "assessAnswer" -> AiResult(checkNotNull(assessment), AiUsage.none("test"))
                "composeReport" -> AiResult(checkNotNull(report), AiUsage.none("test"))
                else -> RETURNS_DEFAULTS.answer(invocation)
            }
        }

    val service =
        InterviewService(
            repository = repository,
            userRepository = mock(UserRepository::class.java),
            archetypeResolver = archetypes,
            interviewAi = ai,
            storage = mock(ObjectStorage::class.java),
            storageProperties = StorageProperties(),
            objectMapper = mapper,
            questionSpeech = mock(QuestionSpeech::class.java),
            entitlementProperties = EntitlementProperties(),
            roundsProperties = RoundsProperties(),
            retentionProperties = RetentionProperties(),
            roundMedia = RoundMediaProperties(),
            bankRounds = BankRoundPlanner(directory, bank, repository),
            poolRounds = PoolRoundPlanner(directory, pool, repository, poolMaterial),
            resumeService = resumeService,
            roundWorkspaceComposer = RoundWorkspaceComposer(ai, mapper, ProblemVerifier(ai, mapper), poolMaterial),
            codeRunner = mock(CodeRunner::class.java),
            transactionManager =
                mock(PlatformTransactionManager::class.java) { invocation ->
                    if (invocation.method.name == "getTransaction") SimpleTransactionStatus() else null
                },
            backgroundExecutor = SyncTaskExecutor(),
        )

    /** The bank holds [questions] for Amazon's [roundType] rounds. */
    fun bankHolds(
        roundType: RoundType,
        vararg questions: BankQuestion,
    ) {
        given(directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        given(bank.questionsFor(BankFixtures.amazon.id, roundType, false, 100, 0)).willReturn(questions.toList())
        given(bank.countFor(BankFixtures.amazon.id, roundType, false)).willReturn(questions.size)
    }

    /** The pool holds [questions] for [roundType] and the backend family — the rows the repository would return. */
    fun poolHolds(
        roundType: RoundType,
        vararg questions: PoolQuestion,
        companyId: UUID? = BankFixtures.amazon.id,
    ) {
        given(pool.candidatesFor(companyId, Archetype.GLOBAL_PRODUCT, roundType, RoleFamily.BACKEND, 200))
            .willReturn(questions.toList())
    }

    /** A turn as the service wrote it. */
    data class InsertedTurn(
        val turnIndex: Int,
        val questionText: String,
        val provenance: QuestionProvenance?,
        val bankQuestionId: UUID?,
        val poolQuestionId: UUID?,
    )

    /** Every turn the service inserted, read off the mock rather than matched, so no matcher meets a Kotlin non-null. */
    fun insertedTurns(): List<InsertedTurn> =
        mockingDetails(repository)
            .invocations
            .filter { it.method.name == "insertTurn" }
            .map { call ->
                val args = call.arguments
                InsertedTurn(
                    turnIndex = args[2] as Int,
                    questionText = args[3] as String,
                    provenance = (args[6] as String?)?.let { mapper.readValue(it, QuestionProvenance::class.java) },
                    bankQuestionId = args[7] as UUID?,
                    poolQuestionId = args[8] as UUID?,
                )
            }
}
