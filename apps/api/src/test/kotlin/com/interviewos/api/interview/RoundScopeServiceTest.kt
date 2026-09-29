package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.RoundContext
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.verifyNoInteractions
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class RoundScopeServiceTest {
    private val candidate = UUID.fromString("604c33b1-99c5-43f8-8553-690ee187d4d2")
    private val sessionId = UUID.fromString("31bef139-feaf-4a8b-9557-ea7a35d34273")

    @Test
    fun `a custom round requires a topic before any model call`() {
        val harness = BankRoundHarness()
        val failure =
            assertFailsWith<ApiException> {
                harness.service.start(
                    SupabaseIdentity(candidate, "candidate@example.com", null),
                    customStart(focusTopic = null),
                )
            }

        assertEquals("custom_topic_required", failure.code)
        verifyNoInteractions(harness.ai)
    }

    @Test
    fun `a custom round only accepts the short focused durations`() {
        val harness = BankRoundHarness()
        val failure =
            assertFailsWith<ApiException> {
                harness.service.start(
                    SupabaseIdentity(candidate, "candidate@example.com", null),
                    customStart(focusTopic = "Java collections", durationMinutes = 40),
                )
            }

        assertEquals("custom_duration_invalid", failure.code)
        verifyNoInteractions(harness.ai)
    }

    @Test
    fun `the engine forces a new question after the custom round follow-up ceiling`() {
        val harness = BankRoundHarness()
        val now = Instant.now()
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Any company",
                archetype = Archetype.GLOBAL_PRODUCT.dbValue,
                archetypeConfidence = Confidence.INFERRED.dbValue,
                roleTitle = "Software Engineer",
                roundType = RoundType.CUSTOM_TOPIC.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = now.minusSeconds(120),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 20,
                focusTopic = "Java collections",
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 3)).willReturn(
            turn(3, "How does HashMap handle a collision?"),
        )
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            listOf(
                turn(0, "What is a Java collection?", "A container abstraction.", "follow_up"),
                turn(1, "Which implementations have you used?", "ArrayList and HashMap.", "probe"),
                turn(2, "Why choose HashMap?", "Average constant-time lookup.", "challenge"),
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(3, 4)
        harness.assessment =
            AnswerAssessment(
                transcript = "It uses buckets and compares keys.",
                suggestedNextAction = "follow_up",
                nextQuestionText = "Can you go deeper into collision handling?",
                questionBasis = "model_knowledge",
                questionProbes = "collision handling",
                questionAskedBecause = "The candidate mentioned buckets.",
            )

        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 3,
            audio = AnswerAudio("answer".toByteArray(), "audio/webm"),
            speaksLocally = true,
        )

        val assessCall =
            mockingDetails(harness.ai).invocations.single { it.method.name == "assessAnswer" }
        val context = assessCall.arguments[1] as RoundContext
        assertTrue(context.mustMoveOn)
        assertEquals(3, context.followUpLimit)
        assertTrue(
            harness.briefs.last().roundCovers.contains(
                "Stay strictly within the requested topic: Java collections",
            ),
        )

        val recordedAnswer =
            mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertEquals("move_on", recordedAnswer.arguments[7])
    }

    private fun customStart(
        focusTopic: String?,
        durationMinutes: Int = 20,
    ) = StartSessionRequest(
        companyName = "Any company",
        roleTitle = "Software Engineer",
        roundType = RoundType.CUSTOM_TOPIC.dbValue,
        consentAudio = true,
        durationMinutes = durationMinutes,
        focusTopic = focusTopic,
    )

    private fun turn(
        index: Int,
        question: String,
        answer: String? = null,
        nextAction: String? = null,
    ) = TurnRow(
        turnIndex = index,
        questionText = question,
        questionAudioPath = null,
        answerTranscript = answer,
        answeredAt = answer?.let { Instant.now() },
        nextAction = nextAction,
    )
}
