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

/**
 * The same answer as video, when the candidate consented to the camera. Sent to the
 * model alongside the audio so delivery is judged on how someone actually came across —
 * composure, eye contact, whether they froze — and not on a transcript alone.
 */
data class AnswerVideo(
    val bytes: ByteArray,
    val contentType: String,
)

/**
 * Where the round is up to, as the model needs to be told it.
 *
 * The engine decides all of this. A model left to pace itself opens on the hardest
 * question it can think of and never wraps up (CLAUDE.md: interview logic is server-side).
 */
data class RoundContext(
    /** `warm-up`, `main round`, or `closing`. */
    val phase: String,
    val minutesElapsed: Int,
    val minutesRemaining: Int,
    val durationMinutes: Int,
    /** Set out how the round will run before asking the first substantive question. */
    val briefTheCandidate: Boolean,
    /** The clock has run out. Close the interview off warmly on this turn. */
    val mustConclude: Boolean,
)

/** One completed exchange, as the model needs to see the history. */
data class TurnTranscript(
    val questionText: String,
    val answerTranscript: String?,
    /** What the interviewer supplied on this turn, so the report can weigh it. */
    val intervention: Intervention = Intervention.NONE,
    val interventionNote: String? = null,
    /**
     * Warm-up answers are context — who the candidate is, what they have built. They are
     * not evidence of competence and the report must not score them as though they were.
     */
    val warmUp: Boolean = false,
    /** How they came across on this turn, from the video when there was one. */
    val deliveryNote: String? = null,
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
    /** What the interviewer had to supply on this turn. See [Intervention]. */
    val intervention: String = Intervention.NONE.wireValue,
    /** One sentence naming what was supplied, so the report can tell the candidate. */
    val interventionNote: String? = null,
    /**
     * How the candidate came across on this turn — pace, structure, composure, and, when
     * video was sent, what their body language actually showed. Observation only: it
     * never becomes a score on its own.
     */
    val deliveryObservation: String? = null,
    val nextQuestionText: String?,
)

/**
 * How much the interviewer had to help on a single turn.
 *
 * A real interviewer interrupts rambling, offers a forgotten term, and nudges a
 * candidate who is circling the answer — sitting in silence while someone drowns is
 * neither realistic nor informative. But help received is signal: reaching the answer
 * after two hints is not the same performance as reaching it unaided, and the report
 * says so rather than averaging the difference away.
 */
enum class Intervention(
    val wireValue: String,
    val label: String,
    /**
     * How much this turn's competence should be discounted when the candidate needed
     * this level of help. 1.0 means the answer stands entirely on its own.
     */
    val credit: Double,
) {
    NONE("none", "Answered unaided", 1.0),
    REDIRECTED("redirected", "Needed refocusing", 0.85),
    HINTED("hinted", "Needed a nudge", 0.7),
    GUIDED("guided", "Needed leading", 0.5),
    CORRECTED("corrected", "Was corrected", 0.4),
    ;

    val isAssisted: Boolean get() = this != NONE

    companion object {
        fun parse(value: String?): Intervention = entries.firstOrNull { it.wireValue.equals(value?.trim(), ignoreCase = true) } ?: NONE
    }
}

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
    /**
     * How they carried themselves on camera. Null when the candidate declined video —
     * the report says nothing about presence it did not see.
     */
    val presence: String? = null,
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
    /**
     * How the candidate did once the interviewer's help is accounted for. Written by the
     * model; the counts it is given are computed from the turns, not guessed.
     */
    val assistedPerformance: String? = null,
    val competencies: List<CompetencyScore>,
    val annotations: List<AnswerAnnotation>,
    val communication: CommunicationAnalysis,
    val practicePlan: List<PracticePlanItem>,
    val recommendedNextSession: String,
    val outcomeSimulation: OutcomeSimulation,
)
