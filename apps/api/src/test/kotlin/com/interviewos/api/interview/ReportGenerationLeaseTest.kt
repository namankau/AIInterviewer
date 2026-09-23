package com.interviewos.api.interview

import com.interviewos.api.ai.CommunicationAnalysis
import com.interviewos.api.ai.OutcomeSimulation
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.common.ApiException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

class ReportGenerationLeaseTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()
    private val leaseId = UUID.randomUUID()

    @Test
    fun `a completed claim returns the stored report without calling AI`() {
        givenCompletedRound()
        given(harness.repository.findReportJson(sessionId, candidate)).willReturn(null)
        given(harness.repository.claimReportGeneration(sessionId, candidate, leaseId, 600))
            .willReturn(
                ReportGenerationClaim(
                    ReportGenerationClaimStatus.COMPLETED,
                    """{"headline":"Already generated"}""",
                ),
            )

        val report = harness.reportService.report(candidate, sessionId, leaseId)

        assertThat(report["headline"]).isEqualTo("Already generated")
        assertThat(aiCalls("composeReport")).isZero()
    }

    @Test
    fun `a concurrent report request does not call AI twice and AI runs outside a transaction`() {
        givenCompletedRound()
        given(harness.repository.findReportJson(sessionId, candidate)).willReturn(null)
        val firstClaim = AtomicBoolean(true)
        given(harness.repository.claimReportGeneration(sessionId, candidate, leaseId, 600))
            .willAnswer {
                if (firstClaim.getAndSet(false)) {
                    ReportGenerationClaim(ReportGenerationClaimStatus.ACQUIRED)
                } else {
                    ReportGenerationClaim(ReportGenerationClaimStatus.IN_PROGRESS)
                }
            }
        harness.report =
            ReportContent(
                headline = "Evidence-backed feedback",
                summary = "A concise report.",
                competencies = emptyList(),
                annotations = emptyList(),
                communication = CommunicationAnalysis("Clear", "Low", "Steady", "No", "Direct"),
                practicePlan = emptyList(),
                recommendedNextSession = "System design",
                outcomeSimulation = OutcomeSimulation("Simulation", "Likely", "Grounded in the answer."),
            )

        val modelEntered = CountDownLatch(1)
        val releaseModel = CountDownLatch(1)
        val transactionWasActive = AtomicReference<Boolean>()
        harness.onAiCall = { method ->
            if (method == "composeReport") {
                transactionWasActive.set(TransactionSynchronizationManager.isActualTransactionActive())
                modelEntered.countDown()
                check(releaseModel.await(5, TimeUnit.SECONDS))
            }
        }

        Executors.newSingleThreadExecutor().use { executor ->
            val first = executor.submit<Map<String, Any?>> { harness.reportService.report(candidate, sessionId, leaseId) }
            assertThat(modelEntered.await(5, TimeUnit.SECONDS)).isTrue()

            assertThatThrownBy { harness.reportService.report(candidate, sessionId, leaseId) }
                .isInstanceOfSatisfying(ApiException::class.java) {
                    assertThat(it.code).isEqualTo("report_generating")
                }

            releaseModel.countDown()
            assertThat(first.get(5, TimeUnit.SECONDS)["headline"]).isEqualTo("Evidence-backed feedback")
        }

        assertThat(aiCalls("composeReport")).isEqualTo(1)
        assertThat(transactionWasActive.get()).isFalse()
    }

    private fun givenCompletedRound() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Amazon",
                archetype = "global_product",
                archetypeConfidence = "recognised",
                roleTitle = "SDE 2",
                roundType = "behavioural_competency",
                language = "english",
                status = "completed",
                startedAt = Instant.parse("2026-09-23T08:00:00Z"),
                endedAt = Instant.parse("2026-09-23T08:30:00Z"),
                consentVideo = false,
                durationMinutes = 45,
            ),
        )
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            listOf(
                TurnRow(
                    turnIndex = 0,
                    questionText = "Tell me about a difficult decision.",
                    questionAudioPath = null,
                    answerTranscript = "I compared the risks and documented the trade-offs.",
                    answeredAt = Instant.parse("2026-09-23T08:10:00Z"),
                    hintRequestedAt = null,
                    hintText = null,
                    hintLevel = null,
                    provenanceJson = null,
                ),
            ),
        )
    }

    private fun aiCalls(methodName: String): Int = mockingDetails(harness.ai).invocations.count { it.method.name == methodName }
}
