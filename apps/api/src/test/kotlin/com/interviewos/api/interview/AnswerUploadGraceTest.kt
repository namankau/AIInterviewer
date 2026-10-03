package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.pool.anyArg
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willAnswer
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.timeout
import org.mockito.Mockito.verify
import org.springframework.core.task.SimpleAsyncTaskExecutor
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The mid-round stall (3 Oct 2026): the next question must not wait on the recording of
 * the last answer. The upload runs alongside the assessment; a storage request that hangs
 * used to hold the turn for as long as it hung.
 */
class AnswerUploadGraceTest {
    private val uploadMayFinish = CountDownLatch(1)
    private val harness = BankRoundHarness(backgroundExecutor = SimpleAsyncTaskExecutor("upload-test-"))
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @AfterEach
    fun release() = uploadMayFinish.countDown()

    @Test
    fun `a hung recording upload does not hold the next question, and is attached when it lands`() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Infosys",
                archetype = Archetype.SERVICE_BASED_IT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = "Senior Backend Engineer",
                roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(22 * 60),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 45,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 6)).willReturn(
            TurnRow(
                turnIndex = 6,
                questionText = "How did you size the cache?",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(6, 7)
        willAnswer {
            uploadMayFinish.await(30, TimeUnit.SECONDS)
            null
        }.given(harness.storage).upload(anyString(), anyString(), anyArg(), anyString())
        harness.assessment =
            AnswerAssessment(
                transcript = "By the working set.",
                suggestedNextAction = "move_on",
                nextQuestionText = "What would you change about it now?",
            )

        val started = System.nanoTime()
        val response =
            harness.service.submitAnswer(
                userId = candidate,
                sessionId = sessionId,
                turnIndex = 6,
                audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
                speaksLocally = true,
            )
        val waitedMs = (System.nanoTime() - started) / 1_000_000

        assertNotNull(response.nextTurn, "the round carries on")
        assertTrue(waitedMs < 10_000, "the turn waited ${waitedMs}ms on a recording upload")
        val answerWrite = mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertNull(answerWrite.arguments[4], "the answer is recorded without a path it does not have yet")

        uploadMayFinish.countDown()
        verify(harness.repository, timeout(5_000)).attachAnswerAudio(
            sessionId,
            candidate,
            6,
            "$candidate/$sessionId/turn-6-answer.webm",
        )
    }

    @Test
    fun `an upload that finishes under the assessment is recorded with the answer as before`() {
        uploadMayFinish.countDown()
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Infosys",
                archetype = Archetype.SERVICE_BASED_IT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = "Senior Backend Engineer",
                roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(60),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 45,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 0)).willReturn(
            TurnRow(
                turnIndex = 0,
                questionText = "Tell me about yourself.",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(0, 1)
        harness.assessment = AnswerAssessment(transcript = "I build systems.", suggestedNextAction = "conclude", nextQuestionText = null)

        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 0,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            speaksLocally = true,
        )

        val answerWrite = mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertEquals("$candidate/$sessionId/turn-0-answer.webm", answerWrite.arguments[4])
        assertTrue(mockingDetails(harness.repository).invocations.none { it.method.name == "attachAnswerAudio" })
    }
}
