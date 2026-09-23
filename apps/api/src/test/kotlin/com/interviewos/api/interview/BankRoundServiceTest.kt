package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.interview.BankFixtures.question
import com.interviewos.api.pool.Association
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * A spoken round run through the real [InterviewService]: which turn asks the bank
 * question, what the candidate hears, and what each turn is labelled. With task 042, the
 * selection order too: bank, then pool, then live questions.
 */
class BankRoundServiceTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    private val disagreed = question("Tell me about a time you disagreed with your manager.", corroboration = 2)
    private val other = question("Tell me about a time you failed.", corroboration = 1)

    @Test
    fun `the first question of the round proper is the bank question, put back when the model drifted`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed)
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment =
            assessment(
                next = "We have about twenty minutes, and I want to hear how you work with people. Describe a conflict with your boss?",
                askedPlanned = false,
            )

        submit(turnIndex = 2)

        val planned = assertNotNull(harness.briefs.last().plannedQuestion)
        assertTrue(planned.askNow)
        assertEquals(disagreed.text, planned.text)

        val turn = harness.insertedTurns().single()
        assertEquals(
            "We have about twenty minutes, and I want to hear how you work with people. ${disagreed.text}",
            turn.questionText,
        )
        assertEquals(disagreed.id, turn.bankQuestionId)
        val provenance = assertNotNull(turn.provenance)
        assertEquals(ProvenanceTier.PUBLISHED_SOURCE, provenance.tier)
        assertEquals(disagreed.citations.map { it.url }, provenance.sources.map { it.url })
    }

    @Test
    fun `a follow-up in a round with bank questions is the model's own, with nothing cited`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed)
        givenSpokenRoundAt(answeredBefore = 4)
        harness.assessment = assessment(next = "What did your manager say when you pushed back?", askedPlanned = false)

        submit(turnIndex = 4)

        assertTrue(assertNotNull(harness.briefs.last().plannedQuestion).askNow.not())
        val turn = harness.insertedTurns().single()
        assertEquals("What did your manager say when you pushed back?", turn.questionText)
        assertNull(turn.bankQuestionId)
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, assertNotNull(turn.provenance).tier)
        assertTrue(assertNotNull(turn.provenance).sources.isEmpty())
    }

    @Test
    fun `a new topic that asks the planned question in the model's words keeps them`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed)
        givenSpokenRoundAt(answeredBefore = 4)
        val said = "Switching topics. Walk me through a time you disagreed with a manager."
        harness.assessment = assessment(next = said, askedPlanned = true)

        submit(turnIndex = 4)

        val turn = harness.insertedTurns().single()
        assertEquals(said, turn.questionText)
        assertEquals(disagreed.id, turn.bankQuestionId)
        assertEquals(ProvenanceTier.PUBLISHED_SOURCE, assertNotNull(turn.provenance).tier)
    }

    @Test
    fun `a question already asked in this round is not planned again`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed, other)
        given(harness.repository.askedBankQuestions(candidate, sessionId))
            .willReturn(listOf(AskedBankQuestion(disagreed.id, Instant.now(), inThisRound = true)))
        givenSpokenRoundAt(answeredBefore = 4)
        harness.assessment = assessment(next = "What happened next?", askedPlanned = false)

        submit(turnIndex = 4)

        assertEquals(other.text, assertNotNull(harness.briefs.last().plannedQuestion).text)
    }

    @Test
    fun `nothing in the bank runs the round as before, labelled as the model's own`() {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment = assessment(next = "Tell me about a time you had to push back on a deadline.", askedPlanned = null)

        submit(turnIndex = 2)

        assertNull(harness.briefs.last().plannedQuestion)
        val turn = harness.insertedTurns().single()
        assertEquals("Tell me about a time you had to push back on a deadline.", turn.questionText)
        assertNull(turn.bankQuestionId)
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, assertNotNull(turn.provenance).tier)
    }

    // -- task 042: the pool, behind the bank ------------------------------------

    private val ownership =
        PoolFixtures.question(
            "Tell me about a time you took ownership of a problem nobody had assigned to you.",
            association = Association.COMPANY_SPECIFIC,
            knowledgeBasis = "Publishes leadership principles, one of which is Ownership.",
        )
    private val conflict = PoolFixtures.question("Tell me about a time you disagreed with a senior colleague.")

    @Test
    fun `bank empty and pool present - the round asks the pool question, labelled as model knowledge`() {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        harness.poolHolds(RoundType.BEHAVIOURAL_COMPETENCY, ownership)
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment = assessment(next = "Let's move on. Describe a project you liked?", askedPlanned = false)

        submit(turnIndex = 2)

        val planned = assertNotNull(harness.briefs.last().plannedQuestion)
        assertEquals(ownership.text, planned.text)
        assertFalse(planned.reported)
        val turn = harness.insertedTurns().single()
        assertEquals("Let's move on. ${ownership.text}", turn.questionText)
        assertEquals(ownership.id, turn.poolQuestionId)
        assertNull(turn.bankQuestionId)
        val provenance = assertNotNull(turn.provenance)
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, provenance.tier)
        assertTrue(provenance.sources.isEmpty())
        assertEquals(
            "Generated by our AI interviewer from general knowledge. Not a verified report of a question Amazon asked.",
            provenance.label,
        )
    }

    @Test
    fun `bank present - the bank keeps first claim and the pool is never read`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed)
        harness.poolHolds(RoundType.BEHAVIOURAL_COMPETENCY, ownership)
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment = assessment(next = disagreed.text, askedPlanned = true)

        submit(turnIndex = 2)

        val planned = assertNotNull(harness.briefs.last().plannedQuestion)
        assertEquals(disagreed.text, planned.text)
        assertTrue(planned.reported)
        assertEquals(disagreed.id, harness.insertedTurns().single().bankQuestionId)
        assertNull(harness.insertedTurns().single().poolQuestionId)
        verifyNoInteractions(harness.pool)
    }

    @Test
    fun `a pool question this candidate was asked in an earlier round is not planned again`() {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        harness.poolHolds(RoundType.BEHAVIOURAL_COMPETENCY, ownership, conflict)
        given(harness.repository.askedPoolQuestions(candidate, sessionId))
            .willReturn(listOf(AskedPoolQuestion(ownership.id, Instant.now().minusSeconds(86_400), inThisRound = false)))
        givenSpokenRoundAt(answeredBefore = 4)
        harness.assessment = assessment(next = "What happened next?", askedPlanned = false)

        submit(turnIndex = 4)

        assertEquals(conflict.text, assertNotNull(harness.briefs.last().plannedQuestion).text)
    }

    @Test
    fun `every pool question already asked - live questions, never a repeat`() {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        harness.poolHolds(RoundType.BEHAVIOURAL_COMPETENCY, ownership)
        given(harness.repository.askedPoolQuestions(candidate, sessionId))
            .willReturn(listOf(AskedPoolQuestion(ownership.id, Instant.now().minusSeconds(86_400), inThisRound = false)))
        givenSpokenRoundAt(answeredBefore = 2)
        harness.assessment = assessment(next = "Tell me about a deadline you missed.", askedPlanned = null)

        submit(turnIndex = 2)

        assertNull(harness.briefs.last().plannedQuestion)
        val turn = harness.insertedTurns().single()
        assertNull(turn.poolQuestionId)
        assertNull(assertNotNull(turn.provenance).label)
    }

    @Test
    fun `the warm-up is never handed a bank question`() {
        harness.bankHolds(RoundType.BEHAVIOURAL_COMPETENCY, disagreed)
        givenSpokenRoundAt(answeredBefore = 0)
        harness.assessment = assessment(next = "What are you working on at the moment?", askedPlanned = null)

        submit(turnIndex = 0)

        assertNull(harness.briefs.last().plannedQuestion)
        assertNull(harness.insertedTurns().single().bankQuestionId)
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

    private fun submit(turnIndex: Int) =
        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = turnIndex,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            speaksLocally = true,
        )

    private fun assessment(
        next: String,
        askedPlanned: Boolean?,
    ) = AnswerAssessment(
        transcript = "An answer.",
        suggestedNextAction = "move_on",
        nextQuestionText = next,
        questionBasis = "Behavioural rounds ask for conflict.",
        questionProbes = "How they handle disagreement.",
        questionAskedBecause = "You mentioned pushing back.",
        askedPlannedQuestion = askedPlanned,
    )
}
