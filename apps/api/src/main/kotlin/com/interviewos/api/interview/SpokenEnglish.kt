package com.interviewos.api.interview

import com.interviewos.api.ai.SpokenEnglishContent
import kotlin.math.roundToInt

/**
 * The report's spoken-English section (PRD §09): how fast the candidate spoke, how long
 * they paused, how they used the language.
 *
 * This section makes claims about a real person's speech, so it follows the same rule as
 * every score in the report — **nothing is shown that was not measured or quoted.**
 *
 * - Every number is computed here, from two things that were actually observed: the
 *   timing the browser measured from the microphone level ([AnswerTiming]) and the words
 *   in the transcript. No model estimates a pace or a pause.
 * - The model contributes only observations, and [verifiedObservations] keeps one only if
 *   its quote is really in an answer, it states no number of its own, and it says nothing
 *   about accent or pronunciation — the report model reads a transcript and has heard
 *   nothing, and an accent is not a measure of whether somebody can be understood.
 * - A figure that cannot be measured is null, with a sentence saying why. An older round
 *   with no timing, a round with a code or drawing workspace, an answer too short to time:
 *   each says so rather than showing a number that would only look like a measurement.
 * - A Hindi-English round is the candidate's choice. Its English is not assessed, and
 *   switching between the two is never counted against them.
 */
object SpokenEnglish {
    /**
     * A range commonly cited for comfortable conversational English. It is a rough guide
     * and is presented as one — the band only says which side of it a number fell on.
     */
    const val PACE_RANGE_LOW = 120
    const val PACE_RANGE_HIGH = 160

    /** Below this, a pace is mostly the noise of where the first and last word fell. */
    const val MIN_SPEAKING_MS_FOR_PACE = 5_000L
    const val MIN_WORDS_FOR_PACE = 10

    /**
     * Outside this, the word count and the timing disagree — the meter missed quiet speech,
     * or the transcript is not of this recording — and the pace would be an artefact.
     */
    val PLAUSIBLE_WPM = 20..320

    const val MAX_OBSERVATIONS = 8

    const val HINDI_ENGLISH = "hindi_english"

    /** Non-lexical hesitation sounds. "like" and "basically" are words too, so they are the model's call, with a quote. */
    private val HESITATIONS = setOf("um", "umm", "uhm", "uh", "uhh", "er", "erm", "hmm", "hm")

    private val ASPECTS =
        linkedMapOf(
            "fluency" to "Fluency",
            "filler_words" to "Filler words",
            "grammar" to "Grammar and sentence formation",
            "vocabulary" to "Vocabulary",
            "clarity" to "Clarity",
            "coherence" to "Coherence",
        )

    /** A number with a unit of time, rate or share: the model does not get to state one. */
    private val STATED_MEASURE =
        Regex(
            "(?i)(\\d+(?:[.,]\\d+)?\\s*(?:%|per\\s*cent\\b|percent\\b|wpm\\b|words?\\s+(?:per|a)\\s+minute\\b|" +
                "seconds?\\b|secs?\\b|s\\b|ms\\b|milliseconds?\\b|minutes?\\b|mins?\\b))|" +
                "(\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)[\\s-]+(?:seconds?|minutes?)\\b)",
        )

    /** Accent and nativeness are never assessed; a transcript cannot show pronunciation. */
    private val OFF_LIMITS =
        Regex("(?i)\\b(?:accent\\w*|(?:mis)?pronunciation|(?:mis)?pronounc\\w*|native|nativeness|non-native|mother[\\s-]tongue)\\b")

    /** One answered turn, as this section needs it. */
    data class Answer(
        val transcript: String,
        val timing: AnswerTiming?,
    )

    /** Words in [text]: tokens with a letter or digit in them, punctuation trimmed. */
    fun words(text: String): List<String> =
        text
            .split(Regex("\\s+"))
            .map { token -> token.trim { !it.isLetterOrDigit() && it != '\'' } }
            .filter { token -> token.any { it.isLetterOrDigit() } }

    fun isHesitation(word: String): Boolean = word.lowercase() in HESITATIONS

    /**
     * Everything this section can measure, with no observations yet — those come from
     * the model afterwards and pass through [verifiedObservations].
     */
    fun measure(
        answers: List<Answer>,
        language: String,
        hasWorkspace: Boolean,
    ): ReportSpokenEnglishView {
        val languageAssessed = language != HINDI_ENGLISH
        val perAnswer =
            answers.map { answer ->
                val all = words(answer.transcript)
                val hesitations = all.count { isHesitation(it) }
                Measured(all.size - hesitations, hesitations, answer.timing.takeIf { !hasWorkspace && usable(it, all.size) })
            }

        val timed = perAnswer.filter { it.timing != null }
        val paced = perAnswer.filter { it.wordsPerMinute() != null }
        val wordCount = perAnswer.sumOf { it.words }
        val hesitationCount = perAnswer.sumOf { it.hesitations }

        val wordsPerMinute =
            paced
                .takeIf { it.isNotEmpty() }
                ?.let { rate(it.sumOf { a -> a.words }, it.sumOf { a -> a.timing!!.speakingMs }) }
        val timings = timed.mapNotNull { it.timing }
        val spokenMs = timings.sumOf { it.speakingMs }

        return ReportSpokenEnglishView(
            languageAssessed = languageAssessed,
            scope = scopeOf(languageAssessed),
            answersTotal = answers.size,
            answersTimed = timed.size,
            timingNote = timingNote(hasWorkspace, timed.size, answers.size),
            wordCount = wordCount,
            wordsPerMinute = wordsPerMinute,
            paceBand = wordsPerMinute?.takeIf { languageAssessed }?.let { bandOf(it) },
            paceNote = paceNote(wordsPerMinute, paced.size, timed.size, hasWorkspace, languageAssessed),
            pauseCount = timings.takeIf { it.isNotEmpty() }?.sumOf { it.pauseCount },
            longestPauseSeconds = timings.takeIf { it.isNotEmpty() }?.let { seconds(it.maxOf { t -> t.longestPauseMs }) },
            pauseSharePercent =
                timings.takeIf { spokenMs > 0 }?.let { (it.sumOf { t -> t.totalPauseMs } * 100.0 / spokenMs).roundToInt() },
            medianFirstWordSeconds = median(timings.mapNotNull { it.firstSoundMs })?.let { seconds(it) },
            hesitationCount = hesitationCount.takeIf { languageAssessed },
            hesitationsPer100Words =
                if (languageAssessed && wordCount > 0) (hesitationCount * 1000.0 / wordCount).roundToInt() / 10.0 else null,
            answers =
                perAnswer.mapIndexed { index, answer ->
                    ReportSpokenAnswerView(
                        turnIndex = index,
                        words = answer.words,
                        wordsPerMinute = answer.wordsPerMinute(),
                        pauseCount = answer.timing?.pauseCount,
                        longestPauseSeconds = answer.timing?.let { seconds(it.longestPauseMs) },
                        firstWordSeconds = answer.timing?.firstSoundMs?.let { seconds(it) },
                    )
                },
            observations = emptyList(),
        )
    }

    /**
     * What the report model is told: the measured figures it has to stay consistent with,
     * or, in a Hindi-English round, to leave English alone.
     */
    fun promptContext(measured: ReportSpokenEnglishView): String {
        if (!measured.languageAssessed) {
            return "This round was conducted in Hindi-English, by the candidate's choice. Do not assess their " +
                "English: set `spokenEnglish` to null, and do not treat switching between Hindi and English as a " +
                "weakness anywhere in this report."
        }
        return buildString {
            append("This round was conducted in English. These figures were measured, not estimated, and the ")
            append("candidate sees them exactly as they are beside your observations:\n")
            if (measured.wordsPerMinute != null) {
                append("- Speaking pace: ${measured.wordsPerMinute} words per minute ")
                append("(a range commonly cited for conversational English is $PACE_RANGE_LOW–$PACE_RANGE_HIGH).\n")
            } else {
                append("- Speaking pace: not measured.\n")
            }
            if (measured.pauseCount != null) {
                append("- Pauses of a second or longer: ${measured.pauseCount}")
                measured.longestPauseSeconds?.takeIf { measured.pauseCount > 0 }?.let { append("; longest $it seconds") }
                measured.pauseSharePercent?.let { append("; $it% of speaking time") }
                append(".\n")
            } else {
                append("- Pauses: not measured.\n")
            }
            measured.medianFirstWordSeconds?.let { append("- Typical wait before the first word: $it seconds.\n") }
            append("- Hesitation sounds (um, uh, er, hmm) in the transcript: ${measured.hesitationCount ?: 0}.")
        }
    }

    /**
     * The model's observations that can be shown: a known aspect, a quote found verbatim
     * (loosely on case and punctuation) inside one answer, no number of its own, and
     * nothing about accent or pronunciation. The turn is where the engine found the quote,
     * not where the model said it was.
     */
    fun verifiedObservations(
        content: SpokenEnglishContent?,
        transcripts: List<String>,
        languageAssessed: Boolean,
    ): List<ReportSpokenObservationView> {
        if (!languageAssessed || content == null) return emptyList()
        val answers = transcripts.map { it.normaliseForMatch() }
        return content.observations
            .mapNotNull { observation ->
                val aspect = observation.aspect.trim().lowercase()
                val label = ASPECTS[aspect] ?: return@mapNotNull null
                val quote = observation.evidenceQuote.normaliseForMatch()
                if (quote.isBlank()) return@mapNotNull null
                val turnIndex = answers.indexOfFirst { it.contains(quote) }
                if (turnIndex < 0) return@mapNotNull null
                if (observation.finding.isBlank() || observation.suggestion.isBlank()) return@mapNotNull null
                val said = "${observation.finding} ${observation.suggestion}"
                if (STATED_MEASURE.containsMatchIn(said) || OFF_LIMITS.containsMatchIn(said)) return@mapNotNull null
                ReportSpokenObservationView(
                    aspect = aspect,
                    aspectLabel = label,
                    finding = observation.finding.trim(),
                    evidenceQuote = observation.evidenceQuote.trim(),
                    turnIndex = turnIndex,
                    suggestion = observation.suggestion.trim(),
                )
            }.take(MAX_OBSERVATIONS)
    }

    fun bandOf(wordsPerMinute: Int): String =
        when {
            wordsPerMinute < PACE_RANGE_LOW -> "below"
            wordsPerMinute > PACE_RANGE_HIGH -> "above"
            else -> "within"
        }

    private data class Measured(
        val words: Int,
        val hesitations: Int,
        val timing: AnswerTiming?,
    ) {
        fun wordsPerMinute(): Int? {
            val timing = timing ?: return null
            if (timing.speakingMs < MIN_SPEAKING_MS_FOR_PACE || words < MIN_WORDS_FOR_PACE) return null
            return rate(words, timing.speakingMs).takeIf { it in PLAUSIBLE_WPM }
        }
    }

    /**
     * A timing is usable when it agrees with the transcript on whether anything was said.
     * Words with no speech heard means the meter missed it, and nothing it says about that
     * answer can be trusted.
     */
    private fun usable(
        timing: AnswerTiming?,
        words: Int,
    ): Boolean = timing != null && (timing.firstSoundMs != null || words == 0)

    private fun rate(
        words: Int,
        speakingMs: Long,
    ): Int = (words * 60_000.0 / speakingMs).roundToInt()

    private fun seconds(ms: Long): Double = (ms / 100.0).roundToInt() / 10.0

    private fun median(values: List<Long>): Long? {
        if (values.isEmpty()) return null
        val sorted = values.sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 1) sorted[middle] else (sorted[middle - 1] + sorted[middle]) / 2
    }

    private fun scopeOf(languageAssessed: Boolean): String =
        if (languageAssessed) {
            "How you spoke: pace and pauses measured from your microphone level, and your English read from " +
                "the transcript of your answers. Accent and pronunciation are not assessed."
        } else {
            "You chose a Hindi-English round, so your English is not assessed here and switching between the two " +
                "languages is not counted against you. Pace and pauses are measured across everything you said, " +
                "in both languages."
        }

    private fun timingNote(
        hasWorkspace: Boolean,
        timed: Int,
        total: Int,
    ): String? =
        when {
            hasWorkspace -> {
                "This round had a workspace for code or a diagram, where silences are usually spent writing, so " +
                    "pace and pauses were not measured."
            }

            timed == 0 -> {
                "No timing was recorded for these answers, so pace and pauses are not shown. Rounds sat before we " +
                    "measured timing have none, and neither does an answer the browser could not sample steadily " +
                    "(for example, with the tab in the background)."
            }

            timed < total -> {
                "Timing was recorded for $timed of $total answers, and the pace and pause figures cover those."
            }

            else -> {
                null
            }
        }

    private fun paceNote(
        wordsPerMinute: Int?,
        pacedAnswers: Int,
        timedAnswers: Int,
        hasWorkspace: Boolean,
        languageAssessed: Boolean,
    ): String {
        if (hasWorkspace || timedAnswers == 0) return "Pace was not measured for this round."
        if (wordsPerMinute == null) {
            return "No answer had enough continuous speech to time reliably: a pace needs at least " +
                "${MIN_SPEAKING_MS_FOR_PACE / 1000} seconds and $MIN_WORDS_FOR_PACE words in one answer, and a word " +
                "count that agrees with the timing."
        }
        val across = if (pacedAnswers == 1) "one answer" else "$pacedAnswers answers"
        val measuredAs = "Words per minute from your first word to your last in each answer, pauses included, across $across."
        return if (languageAssessed) {
            "$measuredAs Roughly $PACE_RANGE_LOW–$PACE_RANGE_HIGH words per minute is a range commonly cited for " +
                "comfortable conversational English. It is a rough guide, not a rule: clear speech a little outside " +
                "it is fine."
        } else {
            "$measuredAs The commonly cited $PACE_RANGE_LOW–$PACE_RANGE_HIGH range describes English conversation, " +
                "so it is not applied to a Hindi-English round."
        }
    }
}
