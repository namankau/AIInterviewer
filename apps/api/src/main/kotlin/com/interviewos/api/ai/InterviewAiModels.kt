package com.interviewos.api.ai

import java.time.LocalDate

/*
 * Models exchanged with the interview AI. These are the boundary: everything the engine
 * decides (what to ask next, how scores aggregate, whether a session is billable) is
 * pure Kotlin elsewhere and is unit-tested. What lives here is only what Gemini itself
 * produces — resume structure, speech, per-answer judgement, and the report narrative —
 * and it is mocked at this boundary in tests. No test calls a live model (CLAUDE.md).
 */

/** Token usage for a single model call. Per-session cost is what decides pricing. */
data class AiUsage(
    val model: String,
    val promptTokens: Int,
    val outputTokens: Int,
) {
    operator fun plus(other: AiUsage): AiUsage =
        AiUsage(
            model = if (model == other.model) model else "mixed",
            promptTokens = promptTokens + other.promptTokens,
            outputTokens = outputTokens + other.outputTokens,
        )

    companion object {
        fun none(model: String) = AiUsage(model, 0, 0)
    }
}

/** A model result paired with the usage it cost. */
data class AiResult<T>(
    val value: T,
    val usage: AiUsage,
)

/** A resume as uploaded, handed to the parser. */
data class ResumeFile(
    val bytes: ByteArray,
    val contentType: String,
    val filename: String,
)

// ---------------------------------------------------------------------------
// Resume parsing (PRD 05)
// ---------------------------------------------------------------------------

data class ParsedEmployment(
    val employer: String,
    val title: String?,
    val level: String?,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val current: Boolean = false,
)

data class ParsedProject(
    val name: String,
    val description: String?,
    val technologies: List<String> = emptyList(),
    val domain: String?,
)

data class ParsedEducation(
    val institution: String,
    val qualification: String?,
    val field: String?,
    val endYear: Int?,
)

/**
 * What the parser extracted. Fields it was unsure of are named in [lowConfidenceFields]
 * rather than silently guessed — a wrong employer degrades every future interview, so
 * uncertainty is surfaced for the candidate to confirm, not hidden (PRD 05).
 */
data class ParsedResume(
    val fullName: String?,
    val headline: String?,
    val employments: List<ParsedEmployment> = emptyList(),
    val projects: List<ParsedProject> = emptyList(),
    val education: List<ParsedEducation> = emptyList(),
    val certifications: List<String> = emptyList(),
    val detectedSkills: List<String> = emptyList(),
    val lowConfidenceFields: List<String> = emptyList(),
)

// ---------------------------------------------------------------------------
// The interview brief and the spoken loop (PRD 06)
// ---------------------------------------------------------------------------

/** Everything the model needs to conduct one session, resolved server-side. */
data class InterviewBrief(
    val company: String,
    val archetype: String,
    val role: String,
    val roundType: String,
    val language: String,
    val candidateFunction: String?,
    val candidateLevel: String?,
    val targetLevel: String?,
    /** Archetype-level grounding; carries its own provenance so nothing is invented. */
    val grounding: String,
)

/** 24 kHz PCM as Gemini returns it, plus the mime type to store it under. */
data class SpokenAudio(
    val audio: ByteArray,
    val mimeType: String,
)

data class AskedQuestion(
    val text: String,
)

/** The candidate's answer as captured in the browser. */
data class AnswerAudio(
    val bytes: ByteArray,
    val contentType: String,
)

/** One completed exchange, as the model needs to see the history. */
data class TurnTranscript(
    val questionText: String,
    val answerTranscript: String?,
)

/**
 * The model's judgement of a single spoken answer: the transcript it heard, a short
 * assessment, and — crucially — what it thinks the interviewer should do next. The
 * engine, not the model, owns the final decision about whether the session may continue
 * (PRD 06: all interview logic is server-side), so [suggestedNextAction] is advisory.
 */
data class AnswerAssessment(
    val transcript: String,
    val summary: String,
    val strengths: List<String>,
    val gaps: List<String>,
    val suggestedNextAction: String,
    val nextQuestionText: String?,
)

// ---------------------------------------------------------------------------
// The report (PRD 09)
// ---------------------------------------------------------------------------

/** A competency score, each one anchored to something the candidate actually said. */
data class CompetencyScore(
    val competency: String,
    val score: Int,
    val maxScore: Int,
    val rationale: String,
    /** A quote from the candidate's own transcript. Required — a score without evidence is a badge. */
    val evidenceQuote: String,
    val turnIndex: Int?,
)

data class AnswerAnnotation(
    val turnIndex: Int,
    val question: String,
    val worked: String?,
    val vague: String?,
    val wouldProbe: String?,
    val strongerFraming: String?,
)

data class CommunicationAnalysis(
    val structure: String,
    val fillerDensity: String,
    val pace: String,
    val rambling: String,
    val handlingUncertainty: String,
)

data class PracticePlanItem(
    val focus: String,
    val why: String,
    val drill: String,
)

data class OutcomeSimulation(
    /** Always rendered as an explicit simulation, never as a verdict. */
    val label: String,
    val likelihood: String,
    val reasoning: String,
)

/** The report narrative Gemini composes. Assembly and quote-checking happen elsewhere. */
data class ReportContent(
    val headline: String,
    val summary: String,
    val competencies: List<CompetencyScore>,
    val annotations: List<AnswerAnnotation>,
    val communication: CommunicationAnalysis,
    val practicePlan: List<PracticePlanItem>,
    val recommendedNextSession: String,
    val outcomeSimulation: OutcomeSimulation,
)
