package com.interviewos.api.interview

import com.interviewos.api.ai.CommunicationAnalysis
import com.interviewos.api.ai.OutcomeSimulation
import com.interviewos.api.ai.ReportContent
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CustomRoundReportTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()

    @Test
    fun `a custom report is calibrated to its topic instead of an employer archetype`() {
        given(harness.repository.findReportJson(sessionId, candidate)).willReturn(null)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "General practice",
                archetype = Archetype.GLOBAL_PRODUCT.dbValue,
                archetypeConfidence = Confidence.INFERRED.dbValue,
                roleTitle = "Topic practice",
                roundType = RoundType.CUSTOM_TOPIC.dbValue,
                language = "english",
                status = "completed",
                startedAt = Instant.now().minusSeconds(300),
                endedAt = Instant.now(),
                consentVideo = false,
                durationMinutes = 20,
                focusTopic = "Java collections",
            ),
        )
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            listOf(
                TurnRow(
                    turnIndex = 0,
                    questionText = "When would you choose an ArrayList?",
                    questionAudioPath = null,
                    answerTranscript = "When indexed reads matter and inserts in the middle are uncommon.",
                    answeredAt = Instant.now(),
                ),
            ),
        )
        harness.report =
            ReportContent(
                headline = "Focused Java collections feedback",
                summary = "The answer identified one practical trade-off.",
                competencies = emptyList(),
                annotations = emptyList(),
                communication = CommunicationAnalysis("Clear", "Low", "Steady", "No", "Direct"),
                practicePlan = emptyList(),
                recommendedNextSession = "Another Java collections round",
                outcomeSimulation = OutcomeSimulation("Simulation", "Early evidence", "One answer is limited evidence."),
            )

        val report = harness.reportService.report(candidate, sessionId, UUID.randomUUID())
        val brief = harness.briefs.last()

        assertEquals("Java collections", report.focusTopic)
        assertEquals("Not employer-specific", brief.company)
        assertEquals("Not role-specific", brief.role)
        assertTrue(brief.roundType.contains("Java collections"))
        assertTrue(brief.roundCovers.contains("trade-offs and boundaries within Java collections"))
        assertTrue(brief.grounding.contains("not an employer-specific interview"))
        assertTrue(report.questionSources.headline.contains("Java collections"))
    }
}
