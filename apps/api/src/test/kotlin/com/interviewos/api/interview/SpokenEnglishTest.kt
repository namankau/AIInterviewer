package com.interviewos.api.interview

import com.interviewos.api.ai.SpokenEnglishContent
import com.interviewos.api.ai.SpokenEnglishObservation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SpokenEnglishTest {
    /** [words] words of plain text, so a pace can be computed by hand. */
    private fun text(words: Int) = List(words) { "word$it" }.joinToString(" ")

    private fun timing(
        speakingMs: Long,
        firstSoundMs: Long? = 1_000,
        pauses: List<Long> = emptyList(),
    ) = AnswerTiming(
        recordedMs = (firstSoundMs ?: 0) + speakingMs + 3_500,
        firstSoundMs = firstSoundMs,
        speakingMs = speakingMs,
        pauseCount = pauses.size,
        longestPauseMs = pauses.maxOrNull() ?: 0,
        totalPauseMs = pauses.sum(),
    )

    private fun measure(
        vararg answers: SpokenEnglish.Answer,
        language: String = "english",
        workspace: Boolean = false,
    ) = SpokenEnglish.measure(answers.toList(), language, workspace)

    @Test
    fun `counts words, not punctuation, and tells hesitation sounds apart`() {
        val words = SpokenEnglish.words("Um, so — I built it... uh, twice. It's fine!")

        assertEquals(listOf("Um", "so", "I", "built", "it", "uh", "twice", "It's", "fine"), words)
        assertEquals(2, words.count { SpokenEnglish.isHesitation(it) })
        assertEquals(emptyList(), SpokenEnglish.words("   ...  —  "))
    }

    @Test
    fun `pace is words over the span from first word to last, across answers`() {
        // 150 words in 60 s, and 100 words in 50 s: 250 words in 110 s is 136 wpm.
        val measured =
            measure(
                SpokenEnglish.Answer(text(150), timing(60_000, firstSoundMs = 2_000, pauses = listOf(1_500, 3_000))),
                SpokenEnglish.Answer(text(100), timing(50_000, firstSoundMs = 1_000, pauses = listOf(1_000))),
            )

        assertEquals(136, measured.wordsPerMinute)
        assertEquals("within", measured.paceBand)
        assertThat(measured.paceNote).contains("across 2 answers").contains("120–160").contains("rough guide")
        assertEquals(3, measured.pauseCount)
        assertEquals(3.0, measured.longestPauseSeconds)
        // 5.5 s of pauses in 110 s of speaking.
        assertEquals(5, measured.pauseSharePercent)
        assertEquals(1.5, measured.medianFirstWordSeconds)
        assertEquals(2, measured.answersTimed)
        assertNull(measured.timingNote)
        assertEquals(listOf(150, 120), measured.answers.map { it.wordsPerMinute })
    }

    @Test
    fun `the band only says which side of the stated range a pace fell`() {
        assertEquals("below", SpokenEnglish.bandOf(119))
        assertEquals("within", SpokenEnglish.bandOf(120))
        assertEquals("within", SpokenEnglish.bandOf(160))
        assertEquals("above", SpokenEnglish.bandOf(161))
    }

    @Test
    fun `an empty answer has no words and no pace`() {
        val measured = measure(SpokenEnglish.Answer("", timing(0, firstSoundMs = null)))

        assertEquals(0, measured.wordCount)
        assertNull(measured.wordsPerMinute)
        assertNull(measured.paceBand)
        assertNull(measured.hesitationsPer100Words)
        assertNull(measured.medianFirstWordSeconds)
    }

    @Test
    fun `an answer that was all silence is timed but has nothing to pace`() {
        val measured = measure(SpokenEnglish.Answer("", timing(0, firstSoundMs = null)))

        assertEquals(1, measured.answersTimed)
        assertEquals(0, measured.pauseCount)
        assertNull(measured.pauseSharePercent, "no speech means no share of speech spent paused")
        assertThat(measured.paceNote).contains("enough continuous speech")
    }

    @Test
    fun `a very short answer is not paced, because the number would be noise`() {
        val measured =
            measure(
                SpokenEnglish.Answer("Yes, I have.", timing(900)),
                SpokenEnglish.Answer(text(30), timing(4_000)),
            )

        assertNull(measured.wordsPerMinute)
        assertNull(measured.paceBand)
        assertThat(measured.paceNote).contains("at least 5 seconds and 10 words")
        assertEquals(listOf(null, null), measured.answers.map { it.wordsPerMinute })
    }

    @Test
    fun `words with no speech heard means the meter missed it, so that timing is not used`() {
        val measured = measure(SpokenEnglish.Answer(text(80), timing(0, firstSoundMs = null)))

        assertEquals(0, measured.answersTimed)
        assertNull(measured.pauseCount)
        assertThat(measured.timingNote).contains("No timing was recorded")
    }

    @Test
    fun `a pace the transcript and the timing disagree on is left out`() {
        // 400 words in 10 s would be 2,400 wpm: not a person.
        val measured = measure(SpokenEnglish.Answer(text(400), timing(10_000)))

        assertNull(measured.wordsPerMinute)
        assertEquals(1, measured.answersTimed, "the pauses are still a measurement")
    }

    @Test
    fun `an older round with no timing says so rather than showing numbers`() {
        val measured = measure(SpokenEnglish.Answer(text(120), null), SpokenEnglish.Answer(text(90), null))

        assertEquals(0, measured.answersTimed)
        assertNull(measured.wordsPerMinute)
        assertNull(measured.pauseCount)
        assertNull(measured.longestPauseSeconds)
        assertNull(measured.pauseSharePercent)
        assertNull(measured.medianFirstWordSeconds)
        assertThat(measured.timingNote).contains("No timing was recorded")
        assertEquals("Pace was not measured for this round.", measured.paceNote)
        // The transcript was still there to count.
        assertEquals(210, measured.wordCount)
    }

    @Test
    fun `partial timing is disclosed`() {
        val measured = measure(SpokenEnglish.Answer(text(120), timing(50_000)), SpokenEnglish.Answer(text(90), null))

        assertEquals("Timing was recorded for 1 of 2 answers, and the pace and pause figures cover those.", measured.timingNote)
        assertEquals(144, measured.wordsPerMinute)
    }

    @Test
    fun `a workspace round measures no pace or pauses, because silence there is writing`() {
        val measured = measure(SpokenEnglish.Answer(text(120), timing(50_000, pauses = listOf(8_000))), workspace = true)

        assertEquals(0, measured.answersTimed)
        assertNull(measured.wordsPerMinute)
        assertNull(measured.pauseCount)
        assertThat(measured.timingNote).contains("workspace")
    }

    @Test
    fun `hesitation sounds are counted from the transcript`() {
        val measured = measure(SpokenEnglish.Answer("Um I think uh the cache, um, was the problem here", null))

        assertEquals(3, measured.hesitationCount)
        // Eight words that are not hesitations.
        assertEquals(8, measured.wordCount)
        assertEquals(37.5, measured.hesitationsPer100Words)
    }

    @Test
    fun `a Hindi-English round measures timing but does not assess English or apply the English range`() {
        val measured =
            measure(
                SpokenEnglish.Answer("Maine ek API banaya, um, jo payments handle karta tha " + text(100), timing(50_000)),
                language = "hindi_english",
            )

        assertEquals(false, measured.languageAssessed)
        assertThat(measured.scope).contains("Hindi-English").contains("not counted against you")
        assertThat(measured.wordsPerMinute).isNotNull()
        assertNull(measured.paceBand)
        assertThat(measured.paceNote).contains("not applied to a Hindi-English round")
        assertNull(measured.hesitationCount)
        assertNull(measured.hesitationsPer100Words)
        assertThat(SpokenEnglish.promptContext(measured)).contains("set `spokenEnglish` to null")
    }

    @Test
    fun `the model is told the measured figures and nothing it could restate differently`() {
        val measured = measure(SpokenEnglish.Answer(text(150), timing(60_000, pauses = listOf(2_000))))

        val context = SpokenEnglish.promptContext(measured)

        assertThat(context)
            .contains("150 words per minute")
            .contains("Pauses of a second or longer: 1; longest 2.0 seconds")
            .contains("measured, not estimated")
    }

    @Test
    fun `with no timing the model is told pace was not measured`() {
        val context = SpokenEnglish.promptContext(measure(SpokenEnglish.Answer(text(50), null)))

        assertThat(context).contains("Speaking pace: not measured").contains("Pauses: not measured")
    }

    private fun observation(
        quote: String,
        finding: String = "The sentence runs on without a break.",
        aspect: String = "grammar",
        suggestion: String = "Split it into two sentences.",
        turnIndex: Int? = 7,
    ) = SpokenEnglishObservation(aspect, finding, quote, turnIndex, suggestion)

    @Test
    fun `an observation is kept only with a real quote, and its turn is where the engine found it`() {
        val transcripts = listOf("I worked on payments.", "So basically we, like, basically moved the queue to Kafka.")

        val kept =
            SpokenEnglish.verifiedObservations(
                SpokenEnglishContent(
                    listOf(
                        observation("basically we like basically moved", aspect = "filler_words"),
                        observation("we rebuilt the whole platform"),
                    ),
                ),
                transcripts,
                languageAssessed = true,
            )

        assertEquals(1, kept.size)
        assertEquals("filler_words", kept.single().aspect)
        assertEquals("Filler words", kept.single().aspectLabel)
        assertEquals(1, kept.single().turnIndex, "the model said 7; the quote is in answer 1")
    }

    @Test
    fun `an observation about accent or pronunciation is never shown`() {
        val transcripts = listOf("We moved the queue to Kafka.")

        val kept =
            SpokenEnglish.verifiedObservations(
                SpokenEnglishContent(
                    listOf(
                        observation("moved the queue", finding = "A strong Indian accent made this hard to follow."),
                        observation("moved the queue", finding = "Kafka was mispronounced."),
                        observation("moved the queue", suggestion = "Practise sounding like a native speaker."),
                        observation("moved the queue", aspect = "clarity", finding = "Clear and specific."),
                    ),
                ),
                transcripts,
                languageAssessed = true,
            )

        assertEquals(listOf("Clear and specific."), kept.map { it.finding })
    }

    @Test
    fun `an observation stating its own number is dropped, because the numbers are measured`() {
        val transcripts = listOf("We moved the queue to Kafka.")

        val kept =
            SpokenEnglish.verifiedObservations(
                SpokenEnglishContent(
                    listOf(
                        observation("moved the queue", aspect = "fluency", finding = "You spoke at about 190 wpm here."),
                        observation("moved the queue", aspect = "fluency", finding = "There was a 4 second gap before this."),
                        observation("moved the queue", aspect = "fluency", finding = "A three-second pause broke the sentence."),
                        observation("moved the queue", aspect = "fluency", finding = "Around 30% of this was filler."),
                        observation("moved the queue", aspect = "vocabulary", finding = "Kafka is the precise term."),
                    ),
                ),
                transcripts,
                languageAssessed = true,
            )

        assertEquals(listOf("Kafka is the precise term."), kept.map { it.finding })
    }

    @Test
    fun `unknown aspects, blank quotes and blank findings are dropped`() {
        val transcripts = listOf("We moved the queue to Kafka.")

        val kept =
            SpokenEnglish.verifiedObservations(
                SpokenEnglishContent(
                    listOf(
                        observation("moved the queue", aspect = "confidence"),
                        observation("   "),
                        observation("moved the queue", finding = " "),
                        observation("moved the queue", aspect = " Coherence "),
                    ),
                ),
                transcripts,
                languageAssessed = true,
            )

        assertEquals(listOf("coherence"), kept.map { it.aspect })
    }

    @Test
    fun `no observations in a Hindi-English round, whatever the model wrote`() {
        val kept =
            SpokenEnglish.verifiedObservations(
                SpokenEnglishContent(listOf(observation("moved the queue"))),
                listOf("We moved the queue to Kafka."),
                languageAssessed = false,
            )

        assertEquals(emptyList(), kept)
        assertEquals(emptyList(), SpokenEnglish.verifiedObservations(null, listOf("x"), languageAssessed = true))
    }
}
