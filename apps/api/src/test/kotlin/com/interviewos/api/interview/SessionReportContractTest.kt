package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.eq
import org.mockito.BDDMockito.given
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

@WebMvcTest(SessionController::class)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
)
class SessionReportContractTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @MockitoBean
    private lateinit var interviewService: InterviewService

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `report endpoint serialises the public report contract`() {
        given(reportService.report(same(candidate), same(sessionId), anyUuid())).willReturn(report())

        val body =
            mockMvc
                .perform(get("/api/v1/sessions/$sessionId/report").with(tokenFor(candidate)))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
                .andExpect(jsonPath("$.roundType").value("behavioural_competency"))
                .andExpect(jsonPath("$.generatedAt").value("2026-09-23T08:31:00Z"))
                .andExpect(jsonPath("$.assistance.breakdown[0].label").value("Light hint"))
                .andExpect(jsonPath("$.questionSources.entries[0].tier").value("published_source"))
                .andExpect(jsonPath("$.communication.presence").isEmpty)
                .andExpect(jsonPath("$.spokenEnglish.wordsPerMinute").value(142))
                .andExpect(jsonPath("$.spokenEnglish.paceBand").value("within"))
                .andExpect(jsonPath("$.spokenEnglish.observations[0].evidenceQuote").value("I compared the risks"))
                .andExpect(jsonPath("$.spokenEnglish.timingNote").isEmpty)
                .andReturn()
                .response
                .contentAsString

        val json = objectMapper.readTree(body)
        assertEquals(
            setOf(
                "sessionId",
                "companyName",
                "roleTitle",
                "roundType",
                "roundLabel",
                "focusTopic",
                "archetypeLabel",
                "answeredTurns",
                "generatedAt",
                "headline",
                "summary",
                "assistance",
                "competencies",
                "annotations",
                "communication",
                "strengths",
                "developmentAreas",
                "questionSources",
                "practicePlan",
                "recommendedNextSession",
                "outcomeSimulation",
                "spokenEnglish",
            ),
            json.propertyNames().toSet(),
        )
    }

    private fun report() =
        SessionReportView(
            sessionId = sessionId,
            companyName = "Amazon",
            roleTitle = "SDE 2",
            roundType = "behavioural_competency",
            roundLabel = "Behavioural and competency",
            archetypeLabel = "Global product company",
            answeredTurns = 1,
            generatedAt = Instant.parse("2026-09-23T08:31:00Z"),
            headline = "Evidence-backed feedback",
            summary = "A concise report.",
            assistance =
                ReportAssistanceView(
                    totalAnswers = 1,
                    unaidedAnswers = 0,
                    assistedAnswers = 1,
                    headline = "One assisted answer",
                    narrative = "The hint helped.",
                    breakdown = listOf(ReportAssistanceBreakdownView("Light hint", 1)),
                    moments = listOf("Clarified the trade-off."),
                ),
            competencies =
                listOf(
                    ReportCompetencyView("Judgement", 4, 5, "Clear trade-offs", "I compared the risks", 0),
                ),
            annotations =
                listOf(
                    ReportAnnotationView(0, "Tell me about a decision.", "Specific", null, null, "Lead with the result."),
                ),
            communication = ReportCommunicationView("Clear", "Low", "Steady", "No", "Direct"),
            strengths =
                listOf(
                    ReportAssessedAreaView("Judgement", "I compared the risks", 0, "Shows care", "Keep quantifying"),
                ),
            questionSources =
                ReportQuestionSourcesView(
                    entries =
                        listOf(
                            ReportQuestionSourceView(
                                turnIndex = 0,
                                question = "Tell me about a decision.",
                                phase = "main",
                                probes = "Judgement",
                                askedBecause = "The role needs trade-off decisions.",
                                basis = "Behavioural pattern",
                                tier = "published_source",
                                tierDisclosure = "Published source",
                                sources =
                                    listOf(
                                        ReportProvenanceSourceView("Interview guide", "Amazon", null, 2026),
                                    ),
                            ),
                        ),
                    employerRecognised = true,
                    archetypeLabel = "Global product company",
                    headline = "One sourced question.",
                    disclosure = "Only cited questions are employer-specific.",
                ),
            practicePlan = listOf(ReportPracticeItemView("Trade-offs", "Be concrete", "Practise one STAR answer")),
            recommendedNextSession = "System design",
            outcomeSimulation = ReportOutcomeView("Simulation", "Likely", "Grounded in the answer."),
            spokenEnglish =
                ReportSpokenEnglishView(
                    languageAssessed = true,
                    scope = "How you spoke.",
                    answersTotal = 1,
                    answersTimed = 1,
                    timingNote = null,
                    wordCount = 120,
                    wordsPerMinute = 142,
                    paceBand = "within",
                    paceNote = "Words per minute from your first word to your last.",
                    pauseCount = 2,
                    longestPauseSeconds = 2.4,
                    pauseSharePercent = 6,
                    medianFirstWordSeconds = 1.2,
                    hesitationCount = 3,
                    hesitationsPer100Words = 2.5,
                    answers = listOf(ReportSpokenAnswerView(0, 120, 142, 2, 2.4, 1.2)),
                    observations =
                        listOf(
                            ReportSpokenObservationView("vocabulary", "Vocabulary", "Precise.", "I compared the risks", 0, "Keep it."),
                        ),
                ),
        )

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }

    private fun same(value: UUID): UUID {
        eq(value)
        return value
    }

    private fun anyUuid(): UUID {
        any(UUID::class.java)
        return UUID(0, 0)
    }
}
