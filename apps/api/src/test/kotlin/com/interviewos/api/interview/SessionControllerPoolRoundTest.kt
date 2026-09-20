package com.interviewos.api.interview

import com.interviewos.api.ai.CommunicationAnalysis
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.OutcomeSimulation
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.bank.QuestionBankController
import com.interviewos.api.bank.QuestionBankProperties
import com.interviewos.api.bank.QuestionBankService
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.reset
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `POST /api/v1/sessions` through the real [InterviewService] with the question bank at its
 * default, not browsable (task 042):
 *
 * - a coding round at a company the bank holds nothing for is set on a verified pool problem,
 *   with no model call and no verification; the opening turn records the pool question and is
 *   `model_knowledge`, and the report written from that turn carries the label;
 * - with `/questions` hidden, a round at a company the bank does hold questions for still
 *   asks one, cited.
 */
@WebMvcTest(controllers = [SessionController::class, QuestionBankController::class])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    SessionControllerPoolRoundTest.Wiring::class,
)
@EnableConfigurationProperties(QuestionBankProperties::class)
class SessionControllerPoolRoundTest {
    @TestConfiguration
    class Wiring {
        @Bean
        fun harness() = BankRoundHarness()

        @Bean
        fun interviewService(harness: BankRoundHarness) = harness.service
    }

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var harness: BankRoundHarness

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    @MockitoBean
    private lateinit var questionBankService: QuestionBankService

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val resolution by lazy { harness.archetypes.resolve("Amazon") }

    private val longestSubstring =
        PoolFixtures.question(
            "Given a string, return the length of its longest substring without repeated characters.",
            roundType = RoundType.CODING_PRACTICAL,
            payload = PoolFixtures.codingPayload(),
        )

    @BeforeEach
    fun reset() {
        reset(harness.repository, harness.bank, harness.pool, harness.directory)
        clearInvocations(harness.ai)
        harness.briefs.clear()
    }

    @Test
    fun `a coding round with nothing in the bank is set on a pool problem, labelled, and the report says so`() {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        harness.poolHolds(RoundType.CODING_PRACTICAL, longestSubstring)
        givenStart(RoundType.CODING_PRACTICAL, workspace = """{"kind":"dsa"}""")

        start(RoundType.CODING_PRACTICAL).andExpect(status().isCreated)

        // No problem composed, no solutions run: the pool's problem was verified when it was written.
        val modelCalls = mockingDetails(harness.ai).invocations.map { it.method.name }
        assertTrue(modelCalls.none { it == "composeProblem" || it == "composeOpeningQuestion" }, modelCalls.toString())

        val workspace =
            harness.mapper.readTree(
                mockingDetails(harness.repository).invocations.single { it.method.name == "setWorkspace" }.arguments[2] as String,
            )
        assertEquals(longestSubstring.text, workspace.path("problem").path("statement").asString())
        assertTrue(workspace.path("problem").path("testsVerified").asBoolean())
        assertEquals(2, workspace.path("problem").path("testCases").size())
        assertTrue(workspace.path("problem").path("referencePython").isNull)

        val opening = harness.insertedTurns().single()
        assertEquals(longestSubstring.id, opening.poolQuestionId)
        assertNull(opening.bankQuestionId)
        val provenance = assertNotNull(opening.provenance)
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, provenance.tier)
        val label =
            "Generated by our AI interviewer from general knowledge. " +
                "Not a verified report of a question asked at a global product company."
        assertEquals(label, provenance.label)

        val entry = reportEntryFor(opening.questionText, provenance)
        assertEquals("model_knowledge", entry["tier"])
        assertEquals(label, entry["tierDisclosure"])
        assertEquals(emptyList<Any>(), entry["sources"])
    }

    @Test
    fun `with the question bank hidden, a round still asks the bank's sourced question`() {
        mockMvc
            .perform(get("/api/v1/question-bank/companies").with(tokenFor(candidate)))
            .andExpect(status().isNotFound)

        val shortener =
            BankFixtures.question(
                "Design a URL shortening service like TinyURL.",
                corroboration = 2,
                roundType = RoundType.SYSTEM_DESIGN,
            )
        harness.bankHolds(RoundType.SYSTEM_DESIGN, shortener)
        harness.case =
            ComposedCase(
                title = "A URL shortening service",
                summary = "Design a URL shortening service like TinyURL.",
                constraints = listOf("100M new URLs a month"),
                openingPrompt = "Let's design a URL shortener like TinyURL. What does it have to do?",
                deepDiveOptions = listOf("Key generation"),
            )
        givenStart(RoundType.SYSTEM_DESIGN, workspace = """{"kind":"system_design","bankQuestionId":"${shortener.id}"}""")

        start(RoundType.SYSTEM_DESIGN).andExpect(status().isCreated)

        val opening = harness.insertedTurns().single()
        assertEquals(shortener.id, opening.bankQuestionId)
        assertEquals(ProvenanceTier.PUBLISHED_SOURCE, assertNotNull(opening.provenance).tier)
        verifyNoInteractions(harness.pool)
    }

    /** The report [ReportService] writes for a completed round whose one answered turn is [question]. */
    private fun reportEntryFor(
        question: String,
        provenance: QuestionProvenance,
    ): Map<*, *> {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(sessionRow(RoundType.CODING_PRACTICAL, "completed", null))
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            listOf(
                TurnRow(
                    turnIndex = 0,
                    questionText = question,
                    questionAudioPath = null,
                    answerTranscript = "I would slide a window over the string and keep a set of what it holds.",
                    answeredAt = Instant.now(),
                    provenanceJson = harness.mapper.writeValueAsString(provenance),
                ),
            ),
        )
        harness.report =
            ReportContent(
                headline = "",
                summary = "",
                competencies = emptyList(),
                annotations = emptyList(),
                communication = CommunicationAnalysis("", "", "", "", ""),
                practicePlan = emptyList(),
                recommendedNextSession = "",
                outcomeSimulation = OutcomeSimulation("Simulation", "", ""),
            )
        val report =
            ReportService(
                harness.repository,
                harness.ai,
                harness.mapper,
                RoundMediaProperties(),
                RetentionProperties(),
                harness.resumeService,
            )
                .report(candidate, sessionId)
        val sources = report["questionSources"] as Map<*, *>
        return (sources["entries"] as List<*>).single() as Map<*, *>
    }

    private fun givenStart(
        roundType: RoundType,
        workspace: String,
    ) {
        given(
            harness.repository.insertSession(
                candidate,
                "Amazon",
                resolution.archetype,
                resolution.confidence,
                "SDE 2",
                roundType.dbValue,
                "english",
                true,
                false,
                45,
            ),
        ).willReturn(sessionId)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(sessionRow(roundType, "in_progress", workspace))
    }

    private fun sessionRow(
        roundType: RoundType,
        status: String,
        workspace: String?,
    ) = SessionRow(
        id = sessionId,
        companyName = "Amazon",
        archetype = resolution.archetype.dbValue,
        archetypeConfidence = resolution.confidence.dbValue,
        roleTitle = "SDE 2",
        roundType = roundType.dbValue,
        language = "english",
        status = status,
        startedAt = null,
        endedAt = null,
        consentVideo = false,
        durationMinutes = 45,
        workspace = workspace,
    )

    private fun start(roundType: RoundType) =
        mockMvc.perform(
            post("/api/v1/sessions")
                .with(tokenFor(candidate))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"companyName":"Amazon","roleTitle":"SDE 2","roundType":"${roundType.dbValue}","language":"english",
                     "consentAudio":true,"consentVideo":false,"durationMinutes":45}
                    """.trimIndent(),
                ),
        )

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
