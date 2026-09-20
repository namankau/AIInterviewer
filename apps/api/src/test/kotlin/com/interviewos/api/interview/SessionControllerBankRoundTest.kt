package com.interviewos.api.interview

import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.BankFixtures.question
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * `POST /api/v1/sessions` for a system design round at a company the bank holds questions
 * for, through the real [InterviewService]: the case is composed as the bank question, and
 * the opening turn stores that question's id and cites that question's sources.
 */
@WebMvcTest(SessionController::class)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    SessionControllerBankRoundTest.Wiring::class,
)
class SessionControllerBankRoundTest {
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

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val shortener =
        question(
            "Design a URL shortening service like TinyURL.",
            corroboration = 3,
            roundType = RoundType.SYSTEM_DESIGN,
        )
    private val body =
        """
        {"companyName":"Amazon","roleTitle":"SDE 2","roundType":"system_design","language":"english",
         "consentAudio":true,"consentVideo":false,"durationMinutes":45}
        """.trimIndent()

    @BeforeEach
    fun reset() {
        clearInvocations(harness.repository, harness.bank)
        harness.briefs.clear()
    }

    @Test
    fun `a round started with a bank question stores its id and cites its sources`() {
        harness.bankHolds(RoundType.SYSTEM_DESIGN, shortener)
        val resolution = harness.archetypes.resolve("Amazon")
        given(
            harness.repository.insertSession(
                candidate,
                "Amazon",
                resolution.archetype,
                resolution.confidence,
                "SDE 2",
                "system_design",
                "english",
                true,
                false,
                45,
            ),
        ).willReturn(sessionId)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Amazon",
                archetype = resolution.archetype.dbValue,
                archetypeConfidence = resolution.confidence.dbValue,
                roleTitle = "SDE 2",
                roundType = "system_design",
                language = "english",
                status = "in_progress",
                startedAt = null,
                endedAt = null,
                consentVideo = false,
                durationMinutes = 45,
                workspace = """{"kind":"system_design","bankQuestionId":"${shortener.id}"}""",
            ),
        )
        harness.case =
            ComposedCase(
                title = "A URL shortening service",
                summary = "Design a URL shortening service like TinyURL, where reads outnumber writes 100 to 1.",
                constraints = listOf("100M new URLs a month", "10B redirects a month", "p99 redirect under 50ms"),
                openingPrompt = "Let's design a URL shortener like TinyURL. What does it have to do?",
                deepDiveOptions = listOf("Key generation"),
            )

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.groundingNote").value(org.hamcrest.Matchers.containsString("reported for Amazon")))

        assertEquals(shortener.text, assertNotNull(harness.briefs.single().plannedQuestion).text)
        val opening = harness.insertedTurns().single()
        assertEquals(0, opening.turnIndex)
        assertEquals(shortener.id, opening.bankQuestionId)
        val provenance = assertNotNull(opening.provenance)
        assertEquals(ProvenanceTier.PUBLISHED_SOURCE, provenance.tier)
        assertEquals(shortener.citations.map { it.url }, provenance.sources.map { it.url })
        assertTrue(provenance.basis.contains("Amazon"))
    }

    /**
     * The same endpoint, the same round, a fresher asking for it (task 048). Refused
     * before anything is written: no session row, and nothing asked of the bank or the
     * model. The candidate is told why rather than quietly given a different round.
     */
    @Test
    fun `refuses a system design round for a campus fresher, and starts nothing`() {
        val fresher =
            """
            {"companyName":"Infosys","roleTitle":"Graduate Engineer Trainee","roundType":"system_design",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":45}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(fresher),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("round_not_run_at_this_level"))
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("campus or new-graduate")))

        verifyNoInteractions(harness.bank)
        assertTrue(harness.insertedTurns().isEmpty(), "nothing may be written for a round that is refused")
    }

    @Test
    fun `rejects a start with no token`() {
        mockMvc
            .perform(post("/api/v1/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(harness.bank)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
