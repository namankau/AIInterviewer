package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.pool.anyArg
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import java.time.Instant
import java.util.UUID
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class AnswerAudioRetentionTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `answer is assessed from audio while only its transcript is persisted`() {
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
        harness.assessment =
            AnswerAssessment(
                transcript = "I build reliable systems.",
                suggestedNextAction = "move_on",
                nextQuestionText = "How do you investigate a failure?",
            )
        val audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm")

        harness.service.submitAnswer(candidate, sessionId, 0, audio, speaksLocally = true)

        val assessed = mockingDetails(harness.ai).invocations.single { it.method.name == "assessAnswer" }
        assertContentEquals(audio.bytes, (assessed.arguments[4] as AnswerAudio).bytes)
        val written = mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertEquals("I build reliable systems.", written.arguments[3])
        verify(harness.storage, never()).upload(anyString(), anyString(), anyArg(), anyString())
    }
}
