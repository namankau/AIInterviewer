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
