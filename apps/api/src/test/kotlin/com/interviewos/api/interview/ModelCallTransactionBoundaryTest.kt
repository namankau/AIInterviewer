package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.OfferedHint
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

/**
 * Guards task 056, L4: `submitAnswer` and `requestHint` used to be `@Transactional`, which
 * held a database connection open for the whole slow model call inside them —
 * `interviewAi.assessAnswer` and `interviewAi.offerHint` respectively. Both now open a
 * transaction only for the database writes that have to commit together, after the model
 * has already answered. This fails if either regresses back to holding a transaction open
 * across the call.
 *
 * [RecordingTransactionManager] is a real (if minimal) [org.springframework.transaction.PlatformTransactionManager]
 * rather than the bare mock [BankRoundHarness] otherwise uses, specifically so `open` means
 * something a test can assert on.
 */
class ModelCallTransactionBoundaryTest {
    private val transactions = RecordingTransactionManager()
    private val harness = BankRoundHarness(transactionManager = transactions)
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `assessAnswer runs with no transaction open, and the writes after it commit their own`() {
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment =
            AnswerAssessment(
                transcript = "An answer.",
                suggestedNextAction = "move_on",
                nextQuestionText = "What happened next?",
                questionBasis = "Basis.",
                questionProbes = "Probes.",
                questionAskedBecause = "Because.",
                askedPlannedQuestion = null,
            )
        var openDuringCall: Int? = null
        harness.onAiCall = { name -> if (name == "assessAnswer") openDuringCall = transactions.open }

        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 2,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            video = null,
            videoContentType = null,
            speaksLocally = true,
        )

        assertEquals(0, openDuringCall, "no transaction should be open while the model call is in flight")
        assertEquals(0, transactions.open, "the transaction opened for the writes after the call must have closed again")
    }

    @Test
    fun `offerHint runs with no transaction open, and the write after it commits its own`() {
        givenSpokenRoundAt(answeredBefore = 2)
        harness.hint = OfferedHint(text = "Think about the edge cases.", assistanceLevel = "hinted")
        var openDuringCall: Int? = null
        harness.onAiCall = { name -> if (name == "offerHint") openDuringCall = transactions.open }

        harness.service.requestHint(userId = candidate, sessionId = sessionId, turnIndex = 2)

        assertEquals(0, openDuringCall, "no transaction should be open while the model call is in flight")
        assertEquals(0, transactions.open, "the transaction opened for the write after the call must have closed again")
    }

    private fun givenSpokenRoundAt(answeredBefore: Int) {
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
                startedAt = Instant.now().minusSeconds(10 * 60),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 40,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, answeredBefore)).willReturn(
            TurnRow(
                turnIndex = answeredBefore,
                questionText = "The question before.",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(answeredBefore)
    }
}
