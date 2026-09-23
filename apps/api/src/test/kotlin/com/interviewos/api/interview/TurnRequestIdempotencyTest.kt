package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.OfferedHint
import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TurnRequestIdempotencyTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val requestId = UUID.fromString("176bd50a-e9a4-4df4-ad50-1c2f47a0c283")

    @Test
    fun `a completed answer retry returns the original response without touching AI`() {
        val original = SubmitAnswerResponse(true, 3, null, "Thanks - the interview is complete.")
        given(harness.repository.claimAnswerRequest(sessionId, candidate, 2, requestId, 600))
            .willReturn(TurnRequestClaim(TurnRequestClaimStatus.COMPLETED, harness.mapper.writeValueAsString(original)))

        val replayed =
            harness.service.submitAnswer(
                candidate,
                sessionId,
                2,
                AnswerAudio(byteArrayOf(9), "audio/webm"),
                requestId = requestId,
            )

        assertEquals(original, replayed)
        assertEquals(0, aiCalls("assessAnswer"))
    }

    @Test
    fun `concurrent answer retries let only the claim winner call AI`() {
        givenRunningTurn()
        harness.assessment =
            AnswerAssessment(
                transcript = "An answer.",
                suggestedNextAction = "conclude",
                nextQuestionText = null,
            )
        val firstClaim = AtomicBoolean(true)
        given(harness.repository.claimAnswerRequest(sessionId, candidate, 2, requestId, 600)).willAnswer {
            if (firstClaim.getAndSet(false)) {
                TurnRequestClaim(TurnRequestClaimStatus.ACQUIRED)
            } else {
                TurnRequestClaim(TurnRequestClaimStatus.IN_PROGRESS)
            }
        }
        val modelEntered = CountDownLatch(1)
        val releaseModel = CountDownLatch(1)
        harness.onAiCall = { call ->
            if (call == "assessAnswer") {
                modelEntered.countDown()
                assertTrue(releaseModel.await(5, TimeUnit.SECONDS))
            }
        }
        val executor = Executors.newFixedThreadPool(2)
        try {
            val accepted =
                executor.submit<SubmitAnswerResponse> {
                    harness.service.submitAnswer(
                        candidate,
                        sessionId,
                        2,
                        AnswerAudio(byteArrayOf(1), "audio/webm"),
                        requestId = requestId,
                    )
                }
            assertTrue(modelEntered.await(5, TimeUnit.SECONDS))

            val duplicate =
                executor
                    .submit<ApiException> {
                        runCatching {
                            harness.service.submitAnswer(
                                candidate,
                                sessionId,
                                2,
                                AnswerAudio(byteArrayOf(1), "audio/webm"),
                                requestId = requestId,
                            )
                        }.exceptionOrNull() as ApiException
                    }.get(5, TimeUnit.SECONDS)

            assertEquals("request_in_progress", duplicate.code)
            assertEquals(1, aiCalls("assessAnswer"))
            releaseModel.countDown()
            assertTrue(accepted.get(5, TimeUnit.SECONDS).sessionComplete)
        } finally {
            releaseModel.countDown()
            executor.shutdownNow()
        }
    }

    @Test
    fun `concurrent hint retries let only the claim winner call AI`() {
        givenRunningTurn()
        harness.hint = OfferedHint("Start with the decision you owned.", "hinted")
        val firstClaim = AtomicBoolean(true)
        given(harness.repository.claimHintRequest(sessionId, candidate, 2, requestId, 600)).willAnswer {
            if (firstClaim.getAndSet(false)) {
                TurnRequestClaim(TurnRequestClaimStatus.ACQUIRED)
            } else {
                TurnRequestClaim(TurnRequestClaimStatus.IN_PROGRESS)
            }
        }
        val modelEntered = CountDownLatch(1)
        val releaseModel = CountDownLatch(1)
        harness.onAiCall = { call ->
            if (call == "offerHint") {
                modelEntered.countDown()
                assertTrue(releaseModel.await(5, TimeUnit.SECONDS))
            }
        }
        val executor = Executors.newFixedThreadPool(2)
        try {
            val accepted = executor.submit<HintView> { harness.service.requestHint(candidate, sessionId, 2, requestId) }
            assertTrue(modelEntered.await(5, TimeUnit.SECONDS))

            val duplicate =
                executor
                    .submit<ApiException> {
                        runCatching { harness.service.requestHint(candidate, sessionId, 2, requestId) }
                            .exceptionOrNull() as ApiException
                    }.get(5, TimeUnit.SECONDS)

            assertEquals("request_in_progress", duplicate.code)
            assertEquals(1, aiCalls("offerHint"))
            releaseModel.countDown()
            assertEquals("Start with the decision you owned.", accepted.get(5, TimeUnit.SECONDS).text)
        } finally {
            releaseModel.countDown()
            executor.shutdownNow()
        }
    }

    private fun givenRunningTurn() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Amazon",
                archetype = Archetype.GLOBAL_PRODUCT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = "SDE 2",
                roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(600),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 40,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 2)).willReturn(
            TurnRow(
                turnIndex = 2,
                questionText = "Tell me about the situation.",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(2)
    }

    private fun aiCalls(name: String): Int = mockingDetails(harness.ai).invocations.count { it.method.name == name }
}
