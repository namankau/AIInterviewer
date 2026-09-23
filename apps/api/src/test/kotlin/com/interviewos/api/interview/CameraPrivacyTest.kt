package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class CameraPrivacyTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `an accepted answer stores and assesses audio only`() {
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
                startedAt = Instant.now().minusSeconds(60),
                endedAt = null,
                consentVideo = true,
                durationMinutes = 40,
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
        harness.assessment =
            AnswerAssessment(
                transcript = "I build backend systems.",
                suggestedNextAction = "conclude",
                nextQuestionText = null,
            )

        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 0,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            speaksLocally = true,
        )

        val uploads = mockingDetails(harness.storage).invocations.filter { it.method.name == "upload" }
        assertEquals(1, uploads.size)
        assertFalse((uploads.single().arguments[1] as String).contains("video"))

        val modelCall = mockingDetails(harness.ai).invocations.single { it.method.name == "assessAnswer" }
        assertEquals(5, modelCall.arguments.size)

        val answerWrite = mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertNull(answerWrite.arguments[5], "the legacy answer_video_path column must stay empty")
    }
}
