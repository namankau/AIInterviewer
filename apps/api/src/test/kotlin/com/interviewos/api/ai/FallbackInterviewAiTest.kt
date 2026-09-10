package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The rules that make a fallback chain safe rather than merely redundant.
 *
 * The dangerous failure is not "no provider answered" — it is a text-only model being
 * handed a recording of somebody's voice and inventing a transcript that then gets scored
 * as though it were real. Most of these tests exist for that.
 */
class FallbackInterviewAiTest {
    private val brief =
        InterviewBrief(
            company = "Infosys",
            archetype = "Service-based IT firm",
            role = "Senior Backend Engineer",
            roundType = "Project deep-dive",
            roundCovers = "- what they personally decided",
            language = "english",
            candidateFunction = null,
            candidateLevel = null,
            targetLevel = null,
            grounding = "archetype patterns",
        )

    private val round =
        RoundContext(
            phase = "main round",
            minutesElapsed = 10,
            minutesRemaining = 30,
            durationMinutes = 40,
            warmupInstruction = null,
            briefTheCandidate = false,
            mustConclude = false,
        )

    private val audio = AnswerAudio(byteArrayOf(1, 2, 3), "audio/wav")

    @Test
    fun `the first provider that works is the one used`() {
        val first = FakeAi("first", MULTIMODAL)
        val second = FakeAi("second", MULTIMODAL)

        val result = FallbackInterviewAi(listOf(first, second)).composeRound("Infosys MR round")

        assertEquals("first", result.usage.model)
        assertEquals(0, second.calls)
    }

    @Test
    fun `a provider that is out of quota is stepped over`() {
        val exhausted = FakeAi("exhausted", MULTIMODAL, fails = AiUnavailableException("over the spend cap"))
        val healthy = FakeAi("healthy", MULTIMODAL)

        val result = FallbackInterviewAi(listOf(exhausted, healthy)).composeRound("Infosys MR round")

        assertEquals("healthy", result.usage.model)
        assertEquals(1, exhausted.calls, "the first one should still have been tried")
    }

    /**
     * The rule the whole design turns on. Kimi and DeepSeek cannot hear a recording, so
     * routing an answer assessment to one would either error or — far worse — produce an
     * invented transcript that the report then scores as if it were what the candidate
     * said.
     */
    @Test
    fun `a spoken answer is never handed to a text-only provider`() {
        val textOnly = FakeAi("kimi", setOf(AiCapability.STRUCTURED_TEXT))
        val gemini = FakeAi("gemini", MULTIMODAL, fails = AiUnavailableException("over the spend cap"))

        assertFailsWith<AiUnavailableException> {
            FallbackInterviewAi(listOf(gemini, textOnly)).assessAnswer(brief, round, emptyList(), "Q?", audio, null)
        }

        assertEquals(0, textOnly.calls, "the text-only model must never see the audio")
    }

    @Test
    fun `the same text-only provider is used happily for text work`() {
        val gemini = FakeAi("gemini", MULTIMODAL, fails = AiUnavailableException("over the spend cap"))
        val textOnly = FakeAi("kimi", setOf(AiCapability.STRUCTURED_TEXT))

        val result = FallbackInterviewAi(listOf(gemini, textOnly)).composeReport(brief, emptyList())

        assertEquals("kimi", result.usage.model)
    }

    /**
     * A malformed request fails identically everywhere. Retrying it down the chain turns
     * one fast error into several slow ones and bills for each.
     */
    @Test
    fun `our own bad request is not retried elsewhere`() {
        val first =
            FakeAi(
                "first",
                MULTIMODAL,
                fails = AiUnavailableException("schema rejected", worthRetryingElsewhere = false),
            )
        val second = FakeAi("second", MULTIMODAL)

        assertFailsWith<AiUnavailableException> {
            FallbackInterviewAi(listOf(first, second)).composeRound("anything")
        }

        assertEquals(0, second.calls)
    }

    @Test
    fun `when everyone fails the last error is reported rather than swallowed`() {
        val chain =
            FallbackInterviewAi(
                listOf(
                    FakeAi("a", MULTIMODAL, fails = AiUnavailableException("a is down")),
                    FakeAi("b", MULTIMODAL, fails = AiUnavailableException("b is down")),
                ),
            )

        val error = assertFailsWith<AiUnavailableException> { chain.composeRound("anything") }

        assertTrue(error.message!!.contains("b is down"))
    }

    @Test
    fun `a capability nobody has fails immediately rather than being tried`() {
        val textOnly = FakeAi("kimi", setOf(AiCapability.STRUCTURED_TEXT))

        val error =
            assertFailsWith<AiUnavailableException> {
                FallbackInterviewAi(listOf(textOnly)).synthesizeSpeech("Hello.", "english")
            }

        assertEquals(0, textOnly.calls)
        assertTrue(error.message!!.contains("SPEECH_SYNTHESIS"))
        assertTrue(!error.worthRetryingElsewhere, "there is nothing to retry against")
    }

    @Test
    fun `a chain reports the union of what its providers can do`() {
        val chain =
            FallbackInterviewAi(
                listOf(
                    FakeAi("kimi", setOf(AiCapability.STRUCTURED_TEXT)),
                    FakeAi("gemini", MULTIMODAL),
                ),
            )

        assertTrue(AiCapability.AUDIO_UNDERSTANDING in chain.capabilities)
        assertTrue(chain.providerName.contains("kimi") && chain.providerName.contains("gemini"))
    }

    // -- the spend ledger -----------------------------------------------------
    //
    // The chain is the only place that sees both what a call cost and which provider
    // answered, so it is the only place the two can be recorded together. Everything
    // below exists because a fall-through used to be invisible: the configuration says
    // cheapest-first, the code reads as though it runs on the cheap model, and the bill
    // said otherwise with nothing in between to explain it.

    @Test
    fun `every answered call is written down`() {
        val records = mutableListOf<AiCallRecord>()

        FallbackInterviewAi(listOf(FakeAi("gemini-lite", MULTIMODAL)), records::add)
            .composeRound("Infosys MR round")

        assertEquals(1, records.size)
        assertEquals("composeRound", records.single().call)
        assertEquals("gemini-lite", records.single().provider)
    }

    /** The field the whole ledger exists for. */
    @Test
    fun `a call served by the first provider records no fallback`() {
        val records = mutableListOf<AiCallRecord>()

        FallbackInterviewAi(listOf(FakeAi("gemini-lite", MULTIMODAL)), records::add)
            .composeRound("Infosys MR round")

        assertNull(records.single().fellBackFrom)
    }

    @Test
    fun `a call served by the model behind it records what it fell back from`() {
        val records = mutableListOf<AiCallRecord>()
        val chain =
            FallbackInterviewAi(
                listOf(
                    FakeAi("gemini-lite", MULTIMODAL, fails = AiUnavailableException("rate limited")),
                    FakeAi("gemini-flash", MULTIMODAL),
                ),
                records::add,
            )

        chain.composeRound("Infosys MR round")

        assertEquals("gemini-flash", records.single().provider)
        assertEquals("gemini-lite", records.single().fellBackFrom)
    }

    /** A provider that never answered was never billed, so it is never recorded. */
    @Test
    fun `nothing is recorded when every provider fails`() {
        val records = mutableListOf<AiCallRecord>()
        val chain =
            FallbackInterviewAi(
                listOf(FakeAi("gemini-lite", MULTIMODAL, fails = AiUnavailableException("down"))),
                records::add,
            )

        assertFailsWith<AiUnavailableException> { chain.composeRound("Infosys MR round") }

        assertTrue(records.isEmpty())
    }

    /**
     * Bookkeeping is not worth an interview. The money is spent whether or not the row
     * lands, so a candidate mid-round must never lose their turn to a failing ledger.
     */
    @Test
    fun `a ledger that cannot write does not fail the round`() {
        val chain =
            FallbackInterviewAi(
                listOf(FakeAi("gemini-lite", MULTIMODAL)),
                { throw IllegalStateException("connection pool exhausted") },
            )

        val result = chain.composeRound("Infosys MR round")

        assertEquals("gemini-lite", result.usage.model)
    }

    @Test
    fun `the call recorded is the one that was asked for`() {
        val records = mutableListOf<AiCallRecord>()
        val chain = FallbackInterviewAi(listOf(FakeAi("gemini-lite", MULTIMODAL)), records::add)

        chain.assessAnswer(brief, round, emptyList(), "Why sharding?", audio, null)
        chain.composeReport(brief, emptyList())

        assertEquals(listOf("assessAnswer", "composeReport"), records.map { it.call })
    }

    private companion object {
        val MULTIMODAL =
            setOf(
                AiCapability.STRUCTURED_TEXT,
                AiCapability.AUDIO_UNDERSTANDING,
                AiCapability.DOCUMENT_UNDERSTANDING,
                AiCapability.SPEECH_SYNTHESIS,
            )
    }

    /** Records whether it was called, so "never handed the audio" can be asserted. */
    private class FakeAi(
        override val providerName: String,
        override val capabilities: Set<AiCapability>,
        private val fails: AiUnavailableException? = null,
    ) : InterviewAi {
        var calls = 0
            private set

        private fun <T> answer(value: T): AiResult<T> {
            calls += 1
            fails?.let { throw it }
            return AiResult(value, AiUsage(providerName, 0, 0))
        }

        override fun parseResume(file: ResumeFile) = answer(ParsedResume(null, null))

        override fun synthesizeSpeech(
            text: String,
            language: String,
        ) = answer(SpokenAudio(ByteArray(0), "audio/wav"))

        override fun composeRound(query: String) =
            answer(ComposedRound("", "", "", "project_deep_dive", null, "english", "", emptyList(), "low"))

        override fun composeProblem(
            brief: InterviewBrief,
            durationMinutes: Int,
        ) = answer(
            ComposedProblem(
                title = "Two Sum",
                topic = "hash map",
                difficulty = "easy",
                statement = "Find two numbers that add to a target.",
                examples = emptyList(),
                constraints = emptyList(),
                starterPython = "print(0)",
                starterJava = "class Main {}",
                stdinFormat = "one line",
                testCases = emptyList(),
            ),
        )

        override fun composeCase(
            brief: InterviewBrief,
            durationMinutes: Int,
        ) = answer(
            ComposedCase(
                title = "Design a feed",
                summary = "Fan-out is the tension.",
                constraints = emptyList(),
                openingPrompt = "What must it do?",
                deepDiveOptions = emptyList(),
            ),
        )

        override fun composeOpeningQuestion(
            brief: InterviewBrief,
            round: RoundContext,
        ) = answer(AskedQuestion("Tell me about yourself."))

        override fun assessAnswer(
            brief: InterviewBrief,
            round: RoundContext,
            priorTurns: List<TurnTranscript>,
            currentQuestion: String,
            answer: AnswerAudio,
            video: AnswerVideo?,
        ) = answer(AnswerAssessment("transcript", "move_on", nextQuestionText = null))

        override fun offerHint(
            brief: InterviewBrief,
            round: RoundContext,
            priorTurns: List<TurnTranscript>,
            currentQuestion: String,
        ) = answer(OfferedHint("A nudge.", "hinted"))

        override fun extractQuestions(source: SourceDocument) = answer(ExtractedQuestions())

        override fun composeReport(
            brief: InterviewBrief,
            transcript: List<TurnTranscript>,
        ) = answer(
            ReportContent(
                headline = "",
                summary = "",
                competencies = emptyList(),
                annotations = emptyList(),
                communication = CommunicationAnalysis("", "", "", "", ""),
                practicePlan = emptyList(),
                recommendedNextSession = "",
                outcomeSimulation = OutcomeSimulation("Simulation", "", ""),
            ),
        )
    }
}
