package com.interviewos.api.interview

import java.time.Instant
import java.util.UUID

/** The versioned public report response (PRD §09). */
data class SessionReportView(
    val sessionId: UUID,
    val companyName: String,
    val roleTitle: String,
    val roundType: String,
    val roundLabel: String,
    /** The candidate-selected scope for a custom round; null for every catalogue round. */
    val focusTopic: String? = null,
    val archetypeLabel: String,
    val answeredTurns: Int,
    val generatedAt: Instant,
    val headline: String,
    val summary: String,
    val assistance: ReportAssistanceView,
    val competencies: List<ReportCompetencyView>,
    val annotations: List<ReportAnnotationView>,
    val communication: ReportCommunicationView,
    val strengths: List<ReportAssessedAreaView> = emptyList(),
    val developmentAreas: List<ReportAssessedAreaView> = emptyList(),
    val questionSources: ReportQuestionSourcesView = ReportQuestionSourcesView(),
    val practicePlan: List<ReportPracticeItemView>,
    val recommendedNextSession: String,
    val outcomeSimulation: ReportOutcomeView,
    /**
     * How the candidate spoke: measured pace and pauses, and quoted observations on their
     * English. Null on a report written before this section existed.
     */
    val spokenEnglish: ReportSpokenEnglishView? = null,
)

data class ReportAssistanceView(
    val totalAnswers: Int,
    val unaidedAnswers: Int,
    val assistedAnswers: Int,
    val headline: String,
    val narrative: String?,
    val breakdown: List<ReportAssistanceBreakdownView>,
    val moments: List<String>,
)

data class ReportAssistanceBreakdownView(
    val label: String,
    val count: Int,
)

data class ReportCompetencyView(
    val competency: String,
    val score: Int,
    val maxScore: Int,
    val rationale: String,
    val evidenceQuote: String,
    val turnIndex: Int?,
)

data class ReportAnnotationView(
    val turnIndex: Int,
    val question: String,
    val worked: String?,
    val vague: String?,
    val wouldProbe: String?,
    val strongerFraming: String?,
)

data class ReportCommunicationView(
    val structure: String,
    val fillerDensity: String,
    val pace: String,
    val rambling: String,
    val handlingUncertainty: String,
    /** Camera remains local, so a public report can only ever carry null here. */
    val presence: String? = null,
)

data class ReportAssessedAreaView(
    val area: String,
    val evidenceQuote: String,
    val turnIndex: Int?,
    val whyItMatters: String,
    val whatToDo: String,
)

data class ReportPracticeItemView(
    val focus: String,
    val why: String,
    val drill: String,
)

data class ReportOutcomeView(
    val label: String,
    val likelihood: String,
    val reasoning: String,
)

data class ReportQuestionSourcesView(
    val entries: List<ReportQuestionSourceView> = emptyList(),
    val employerRecognised: Boolean = false,
    val archetypeLabel: String = "",
    val headline: String = "",
    val disclosure: String = "",
)

data class ReportQuestionSourceView(
    val turnIndex: Int,
    val question: String,
    val phase: String,
    val probes: String,
    val askedBecause: String,
    val basis: String,
    val tier: String,
    val tierDisclosure: String,
    val sources: List<ReportProvenanceSourceView>,
)

data class ReportProvenanceSourceView(
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
)

/**
 * The spoken-English section (PRD §09). Every number in it is measured — the timings by
 * the browser from the microphone level, the word and hesitation counts from the
 * transcript — and computed by the engine (`SpokenEnglish`). The model contributes only
 * [observations], each of which quotes the candidate.
 *
 * A figure that could not be measured is null, and [timingNote] or [paceNote] says why.
 */
data class ReportSpokenEnglishView(
    /** False in a Hindi-English round: English is not assessed and code-switching is not counted against anyone. */
    val languageAssessed: Boolean,
    /** What the section covers, in plain words. */
    val scope: String,
    val answersTotal: Int,
    /** Answers with a usable timing measurement. */
    val answersTimed: Int,
    /** Why timing is missing or partial; null when every answer was timed. */
    val timingNote: String?,
    val wordCount: Int,
    val wordsPerMinute: Int?,
    /** Where [wordsPerMinute] sits against the stated range: `below`, `within`, `above`; null when not compared. */
    val paceBand: String?,
    /** The basis for the pace figure and its range, or why there is none. */
    val paceNote: String,
    val pauseCount: Int?,
    val longestPauseSeconds: Double?,
    val pauseSharePercent: Int?,
    val medianFirstWordSeconds: Double?,
    /** um, uh, er, hmm — counted in the transcript. Null when English is not assessed. */
    val hesitationCount: Int?,
    val hesitationsPer100Words: Double?,
    val answers: List<ReportSpokenAnswerView>,
    val observations: List<ReportSpokenObservationView>,
)

/** One answer's measurements, numbered like the rest of the report (position among answered turns). */
data class ReportSpokenAnswerView(
    val turnIndex: Int,
    val words: Int,
    val wordsPerMinute: Int?,
    val pauseCount: Int?,
    val longestPauseSeconds: Double?,
    val firstWordSeconds: Double?,
)

data class ReportSpokenObservationView(
    val aspect: String,
    val aspectLabel: String,
    val finding: String,
    val evidenceQuote: String,
    /** Where the quote was found — located by the engine, not taken from the model. */
    val turnIndex: Int?,
    val suggestion: String,
)
