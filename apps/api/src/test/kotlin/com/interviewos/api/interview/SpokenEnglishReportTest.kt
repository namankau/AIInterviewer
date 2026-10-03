package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.CommunicationAnalysis
import com.interviewos.api.ai.OutcomeSimulation
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.ai.SpokenEnglishContent
import com.interviewos.api.ai.SpokenEnglishObservation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The spoken-English section end to end, with the model mocked at the boundary: what the
 * browser measured goes in with the answer, and comes out in the report as figures the
 * engine computed — beside only those model observations that quote the candidate.
 */
class SpokenEnglishReportTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()

    private val firstAnswer = "So basically I, um, led the migration of our payments queue to Kafka " + words(140)
    private val secondAnswer = "We measured the lag every hour and we fixed the consumer that was falling behind " + words(90)

    private fun words(count: Int) = List(count) { "step$it" }.joinToString(" ")

    private fun timingJson(
        speakingMs: Long,
        pauses: List<Long>,
        firstSoundMs: Long = 1_200,
    ) = harness.mapper.writeValueAsString(
        AnswerTiming(firstSoundMs + speakingMs + 3_500, firstSoundMs, speakingMs, pauses.size, pauses.maxOrNull() ?: 0, pauses.sum()),
    )

    @Test
    fun `the report carries measured figures and only the observations that quote the candidate`() {
        givenCompletedRound(
            language = "english",
            TurnRow(
                0,
                "Tell me about a migration you led.",
                null,
                answerTranscript = firstAnswer,
                answeredAt = Instant.now(),
                answerTimingJson = timingJson(60_000, listOf(1_500, 2_500)),
            ),
            TurnRow(
                1,
                "How did you know it worked?",
                null,
                answerTranscript = secondAnswer,
                answeredAt = Instant.now(),
                answerTimingJson = timingJson(45_000, listOf(1_100), firstSoundMs = 2_000),
            ),
        )
        harness.report =
            reportContent(
                SpokenEnglishContent(
                    listOf(
                        SpokenEnglishObservation(
                            "filler_words",
                            "Basically adds nothing here.",
                            "So basically I, um, led",
                            1,
                            "Open with the verb: I led the migration.",
                        ),
                        SpokenEnglishObservation(
                            "vocabulary",
                            "Lag is the precise word.",
                            "we measured the lag every hour",
                            null,
                            "Keep naming the metric.",
                        ),
                        SpokenEnglishObservation("grammar", "Invented quote.", "we have went to production", 0, "Say: we went."),
                        SpokenEnglishObservation("clarity", "Your accent made this hard to follow.", "led the migration", 0, "Slow down."),
                        SpokenEnglishObservation("fluency", "You spoke at about 200 wpm.", "led the migration", 0, "Slow down."),
                    ),
                ),
            )

        val report = harness.reportService.report(candidate, sessionId, UUID.randomUUID())

        val spoken = checkNotNull(report.spokenEnglish)
        assertEquals(true, spoken.languageAssessed)
        assertEquals(2, spoken.answersTimed)
        // 152 + 105 words (hesitations excluded) over 105 s of speech.
        assertEquals(257, spoken.wordCount)
        assertEquals(147, spoken.wordsPerMinute)
        assertEquals("within", spoken.paceBand)
        assertEquals(3, spoken.pauseCount)
        assertEquals(2.5, spoken.longestPauseSeconds)
        assertEquals(1, spoken.hesitationCount)
        assertEquals(1.6, spoken.medianFirstWordSeconds)
        assertEquals(
            listOf("filler_words" to 0, "vocabulary" to 1),
            spoken.observations.map { it.aspect to it.turnIndex },
        )

        // The model wrote against the measured figures, not its own impression of them.
        val reportBrief = harness.briefs.last()
        assertThat(reportBrief.spokenEnglish).contains("147 words per minute").contains("measured, not estimated")
    }

    @Test
    fun `a round answered before timing existed says so and invents nothing`() {
        givenCompletedRound(
            language = "english",
            TurnRow(0, "Tell me about a migration you led.", null, answerTranscript = firstAnswer, answeredAt = Instant.now()),
        )
        harness.report = reportContent(null)

        val spoken = checkNotNull(harness.reportService.report(candidate, sessionId, UUID.randomUUID()).spokenEnglish)

        assertEquals(0, spoken.answersTimed)
        assertNull(spoken.wordsPerMinute)
        assertNull(spoken.pauseCount)
        assertNull(spoken.medianFirstWordSeconds)
        assertThat(spoken.timingNote).contains("No timing was recorded")
        assertEquals(emptyList(), spoken.observations)
        assertEquals(1, spoken.hesitationCount, "the transcript can still be counted")
    }

    @Test
    fun `a Hindi-English round leaves English unassessed even if the model wrote about it`() {
        givenCompletedRound(
            language = "hindi_english",
            TurnRow(
                0,
                "Apne project ke baare mein batao.",
                null,
                answerTranscript =
                    "Maine payments queue ko Kafka pe migrate kiya " + words(120),
                answeredAt = Instant.now(),
                answerTimingJson = timingJson(55_000, emptyList()),
            ),
        )
        harness.report =
            reportContent(
                SpokenEnglishContent(
                    listOf(SpokenEnglishObservation("grammar", "Mixed languages.", "Kafka pe migrate kiya", 0, "Use English only.")),
                ),
            )

        val spoken = checkNotNull(harness.reportService.report(candidate, sessionId, UUID.randomUUID()).spokenEnglish)

        assertEquals(false, spoken.languageAssessed)
        assertEquals(emptyList(), spoken.observations)
        assertNull(spoken.paceBand)
        assertNull(spoken.hesitationCount)
        assertThat(spoken.wordsPerMinute).isNotNull()
        assertThat(harness.briefs.last().spokenEnglish).contains("set `spokenEnglish` to null")
    }

    @Test
    fun `a report stored before this section existed reads back without one, and no model is asked`() {
        val stored =
            harness.mapper.writeValueAsString(
                mapOf(
                    "sessionId" to sessionId.toString(),
                    "companyName" to "Amazon",
                    "roleTitle" to "SDE 2",
                    "roundType" to "behavioural_competency",
                    "roundLabel" to "Behavioural and competency",
                    "archetypeLabel" to "Global product company",
                    "answeredTurns" to 1,
                    "generatedAt" to "2026-09-01T10:00:00Z",
                    "headline" to "Older report",
                    "summary" to "Written last month.",
                    "assistance" to
                        mapOf(
                            "totalAnswers" to 1,
                            "unaidedAnswers" to 1,
                            "assistedAnswers" to 0,
                            "headline" to "Unaided",
                            "narrative" to null,
                            "breakdown" to emptyList<Any>(),
                            "moments" to emptyList<Any>(),
                        ),
                    "competencies" to emptyList<Any>(),
                    "annotations" to emptyList<Any>(),
                    "communication" to
                        mapOf("structure" to "s", "fillerDensity" to "f", "pace" to "p", "rambling" to "r", "handlingUncertainty" to "h"),
                    "practicePlan" to emptyList<Any>(),
                    "recommendedNextSession" to "System design",
                    "outcomeSimulation" to mapOf("label" to "Simulation", "likelihood" to "Likely", "reasoning" to "r"),
                ),
            )
        given(harness.repository.findReportJson(sessionId, candidate)).willReturn(stored)

        val report = harness.reportService.report(candidate, sessionId, UUID.randomUUID())

        assertEquals("Older report", report.headline)
        assertNull(report.spokenEnglish)
        assertEquals(0, mockingDetails(harness.ai).invocations.count { it.method.name == "composeReport" })
    }

    @Test
    fun `an answer stores the browser's timing only once it is a consistent measurement`() {
        givenRunningRound()
        val timing = AnswerTiming(20_000, 900, 15_000, 1, 1_300, 1_300)

        submit(harness.mapper.writeValueAsString(timing))

        assertEquals(timing, AnswerTiming.parse(storedTimingJson(), harness.mapper))
    }

    @Test
    fun `an inconsistent or missing timing is stored as nothing, and the answer still counts`() {
        givenRunningRound()

        submit("""{"recordedMs":1000,"firstSoundMs":0,"speakingMs":9000,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}""")

        assertNull(storedTimingJson())
        val answerWrite = mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }
        assertEquals("I led the migration.", answerWrite.arguments[3])
    }

    private fun submit(timing: String?) {
        harness.service.submitAnswer(
            userId = candidate,
            sessionId = sessionId,
            turnIndex = 0,
            audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"),
            speaksLocally = true,
            timing = timing,
        )
    }

    private fun storedTimingJson(): String? =
        mockingDetails(harness.repository).invocations.single { it.method.name == "recordAnswer" }.arguments[12] as String?

    private fun givenRunningRound() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(session("english", "in_progress"))
        given(harness.repository.findTurn(sessionId, candidate, 0)).willReturn(
            TurnRow(0, "Tell me about a migration you led.", null, answerTranscript = null, answeredAt = null),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(0, 1)
        harness.assessment =
            AnswerAssessment(transcript = "I led the migration.", suggestedNextAction = "conclude", nextQuestionText = null)
    }

    private fun givenCompletedRound(
        language: String,
        vararg turns: TurnRow,
    ) {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(session(language, "completed"))
        given(harness.repository.findReportJson(sessionId, candidate)).willReturn(null)
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(turns.toList())
    }

    private fun session(
        language: String,
        status: String,
    ) = SessionRow(
        id = sessionId,
        companyName = "Amazon",
        archetype = Archetype.GLOBAL_PRODUCT.dbValue,
        archetypeConfidence = Confidence.RECOGNISED.dbValue,
        roleTitle = "SDE 2",
        roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
        language = language,
        status = status,
        startedAt = Instant.now().minusSeconds(600),
        endedAt = null,
        consentVideo = false,
        durationMinutes = 40,
    )

    private fun reportContent(spokenEnglish: SpokenEnglishContent?) =
        ReportContent(
            headline = "Evidence-backed feedback",
            summary = "A concise report.",
            competencies = emptyList(),
            annotations = emptyList(),
            communication = CommunicationAnalysis("Clear", "Low", "Steady", "No", "Direct"),
            practicePlan = emptyList(),
            recommendedNextSession = "System design",
            outcomeSimulation = OutcomeSimulation("Simulation", "Likely", "Grounded in the answer."),
            spokenEnglish = spokenEnglish,
        )
}
