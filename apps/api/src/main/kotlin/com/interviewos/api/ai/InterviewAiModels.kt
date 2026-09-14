package com.interviewos.api.ai

import java.time.LocalDate

/*
 * Models exchanged with the interview AI. These are the boundary: everything the engine
 * decides (what to ask next, how scores aggregate, whether a session is billable) is
 * pure Kotlin elsewhere and is unit-tested. What lives here is only what Gemini itself
 * produces — resume structure, speech, per-answer judgement, and the report narrative —
 * and it is mocked at this boundary in tests. No test calls a live model (CLAUDE.md).
 */

/**
 * Token usage for a single model call. Per-session cost is what decides pricing.
 *
 * @param promptTokens every input token, of any modality, as the provider counted them
 * @param outputTokens what the model actually said
 * @param thoughtTokens what it spent reasoning before saying it. **Billed at the output
 *   rate and reported separately**, so a reader who takes [outputTokens] as the bill
 *   undercounts. Measured: `gemini-3.5-flash` spent ~1,600 thinking tokens composing a
 *   report whose visible output was ~1,600 — half that call's output bill was invisible.
 * @param audioTokens the part of [promptTokens] carrying sound, priced higher than text
 * @param cachedTokens the part of [promptTokens] served from a context cache, priced far
 *   lower. Zero unless the provider reports it, which it only does once a stable prefix
 *   is long enough to be cached at all.
 */
data class AiUsage(
    val model: String,
    val promptTokens: Int,
    val outputTokens: Int,
    val thoughtTokens: Int = 0,
    val audioTokens: Int = 0,
    val cachedTokens: Int = 0,
) {
    /**
     * Input tokens billed at the text rate: whatever is left once the parts with their
     * own price have been taken out. Floored at zero — a provider whose counts do not
     * reconcile must not produce a negative bill.
     */
    val textTokens: Int get() = (promptTokens - audioTokens - cachedTokens).coerceAtLeast(0)

    /** Everything charged at the output rate, thinking included. */
    val billedOutputTokens: Int get() = outputTokens + thoughtTokens

    operator fun plus(other: AiUsage): AiUsage =
        AiUsage(
            model = if (model == other.model) model else "mixed",
            promptTokens = promptTokens + other.promptTokens,
            outputTokens = outputTokens + other.outputTokens,
            thoughtTokens = thoughtTokens + other.thoughtTokens,
            audioTokens = audioTokens + other.audioTokens,
            cachedTokens = cachedTokens + other.cachedTokens,
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
    /** As printed on the resume. Validated before it is stored — the model is not a URL parser. */
    val linkedinUrl: String? = null,
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
    /**
     * The ground this round has to get across, one per line.
     *
     * Here so the interviewer always has somewhere to go next that is not deeper into the
     * last answer. Without it a round narrows to whatever the candidate first mentioned
     * and stays there.
     */
    val roundCovers: String,
    val language: String,
    val candidateFunction: String?,
    val candidateLevel: String?,
    val targetLevel: String?,
    /** Archetype-level grounding; carries its own provenance so nothing is invented. */
    val grounding: String,
    /**
     * A question from the bank the engine has chosen for this turn, or for the problem or
     * case a workspace round is set on. Null when there is none, which is the common case.
     */
    val plannedQuestion: PlannedQuestion? = null,
)

/**
 * A reported question the interviewer is to ask, chosen server-side from the company's own
 * questions in the bank. The model may lead into it and shape it for speech; the engine
 * checks what was said against [text] and decides the provenance.
 */
data class PlannedQuestion(
    val text: String,
    /** The employer it is reported at, as the candidate named it. */
    val company: String,
    /** True when it must be asked on this turn; false when it waits for the next new topic. */
    val askNow: Boolean,
)

/** 24 kHz PCM as Gemini returns it, plus the mime type to store it under. */
data class SpokenAudio(
    val audio: ByteArray,
    val mimeType: String,
)

/**
 * A round drafted from a candidate's own words, plus what had to be assumed to draft it.
 *
 * [company] may be empty, and that is a real answer rather than a failure — the round
 * runs on general patterns and the candidate is told so. A guessed employer would be
 * worse, because it silently changes which loop they practise against.
 */
data class ComposedRound(
    val company: String,
    val role: String,
    val level: String,
    val roundType: String,
    val durationMinutes: Int?,
    val language: String,
    /** One sentence back to the candidate, saying what was taken from what they wrote. */
    val understood: String,
    /** Everything filled in that they did not say, so they can correct it at a glance. */
    val assumptions: List<String>,
    val confidence: String,
)

/**
 * The coding problem a DSA round is conducted around, composed once when the round starts.
 *
 * [starterPython] and [starterJava] are **complete runnable programs**, not fragments.
 * They read one case from standard input in the shape [stdinFormat] describes and print
 * only the answer, so a test case can be piped in verbatim and its output compared. That
 * is what makes Run work without us writing a harness per problem — and it is also the
 * part most likely to come back wrong, which is why the round degrades to an editor with
 * no Run rather than failing when it does.
 */
data class ComposedProblem(
    val title: String,
    val topic: String,
    val difficulty: String,
    val statement: String,
    val examples: List<ProblemExample>,
    val constraints: List<String>,
    val starterPython: String,
    val starterJava: String,
    val stdinFormat: String,
    val testCases: List<ProblemTestCase>,
    /**
     * A correct, efficient solution: [starterPython] with the stub filled in.
     *
     * With [bruteForcePython], this is how the expected outputs get checked — see
     * `ProblemVerifier`. Both are cleared before the problem is stored, because the stored
     * problem is sent to the candidate's browser and a solution in the page source is a
     * solution handed over.
     */
    val referencePython: String? = null,
    /** The most obviously correct solution, however slow, written independently of [referencePython]. */
    val bruteForcePython: String? = null,
    /**
     * True when every expected output came from running two independent solutions and
     * getting the same answer, rather than from the model working it out by hand.
     * Set by `ProblemVerifier`, never by the model.
     */
    val testsVerified: Boolean = false,
)

/**
 * What a code sandbox printed, one entry per program the provider actually executed.
 *
 * The output is the sandbox's own stdout, not the model's account of it. A model asked to
 * report what a program prints can get it wrong the same way it gets expected outputs
 * wrong; a sandbox cannot.
 */
data class SandboxRun(
    val outputs: List<String>,
)

data class ProblemExample(
    val input: String,
    val output: String,
    val explanation: String? = null,
)

data class ProblemTestCase(
    val input: String,
    val expected: String,
)

/**
 * The case a system design round is conducted around.
 *
 * [constraints] are the three numbers that force the design's central tension, short
 * enough to sit in a chip on screen. [deepDiveOptions] are for the interviewer and are
 * never shown to the candidate — handing someone the deep dives in advance turns a round
 * that tests scoping into a round that tests reading.
 */
data class ComposedCase(
    val title: String,
    val summary: String,
    val constraints: List<String>,
    val openingPrompt: String,
    val deepDiveOptions: List<String>,
)

data class AskedQuestion(
    val text: String,
    /**
     * Why this question was asked, in the model's own words, captured now rather than
     * reconstructed later. The engine sets the provenance *tier*; the model only
     * describes the pattern it drew on, and is forbidden from citing sources.
     */
    val questionBasis: String? = null,
    val questionProbes: String? = null,
    val questionAskedBecause: String? = null,
)

/**
 * A hint the candidate asked for, and how much of the answer it gave away.
 *
 * [assistanceLevel] maps onto [Intervention], so a requested hint is discounted on the
 * same scale as help the interviewer volunteered.
 */
data class OfferedHint(
    val text: String,
    val assistanceLevel: String,
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
    /**
     * What the warm-up is asking about on this turn, already phrased as an instruction,
     * or null once the round proper has started. The engine owns the opening sequence so
     * that every candidate gets the same one.
     */
    val warmupInstruction: String?,
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
    /*
     * There was a per-turn `summary`, `strengths` and `gaps` here. They were written to
     * the assessment JSON on every turn and read by nothing: the report reasons over the
     * transcript itself, not over these. They cost about 130 output tokens per turn on
     * the one call the candidate sits waiting for, so they are gone.
     */
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
    /**
     * Why the *next* question is being asked, captured as it is composed. Null on a
     * concluding turn, which has no next question to justify.
     *
     * The engine sets the provenance tier; the model only describes the pattern it drew
     * on and its reasoning about this candidate, and is forbidden from citing sources.
     */
    val questionBasis: String? = null,
    val questionProbes: String? = null,
    val questionAskedBecause: String? = null,
    /**
     * The model's word that [nextQuestionText] asks the planned question. Advisory, like
     * everything else here: the engine checks the text before it believes it.
     */
    val askedPlannedQuestion: Boolean? = null,
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
    /**
     * What held up and what did not, each anchored to something the candidate said.
     *
     * Competency scores answer "how well"; these answer "at what, and what do I do about
     * it" — which is the question a candidate actually leaves with. Both carry an
     * evidence quote and both are dropped if that quote is not in the transcript.
     */
    val strengths: List<AssessedArea> = emptyList(),
    val developmentAreas: List<AssessedArea> = emptyList(),
    val practicePlan: List<PracticePlanItem>,
    val recommendedNextSession: String,
    val outcomeSimulation: OutcomeSimulation,
)

/** One thing the candidate did well or badly, with the words that show it. */
data class AssessedArea(
    val area: String,
    val evidenceQuote: String,
    val turnIndex: Int? = null,
    val whyItMatters: String,
    val whatToDo: String,
)

// ---------------------------------------------------------------------------
// The curated source library (PRD 03, 04)
// ---------------------------------------------------------------------------

/** One document from the source library, as the extractor needs to see it. */
data class SourceDocument(
    val title: String?,
    val publisher: String?,
    val companyName: String?,
    val url: String?,
    /** Plain text. HTML is stripped before it gets here. */
    val content: String,
)

/**
 * What was read out of a source.
 *
 * [askedOn] is null far more often than not, and that is correct: the date is shown to
 * candidates as evidence of how current a question is, so it is only ever taken from
 * something the document actually stated.
 */
data class ExtractedQuestion(
    val questionText: String,
    /**
     * Every employer the document says asked this, as it names them. Empty when it names
     * none — never a group like "FAANG". The engine, not the model, falls back to the
     * source's declared company (see `ReportPlan`).
     */
    val companies: List<String> = emptyList(),
    val roundType: String? = null,
    val seniority: String? = null,
    val roleFamily: String? = null,
    val askedOn: java.time.LocalDate? = null,
    val notes: String? = null,
)

data class ExtractedQuestions(
    val questions: List<ExtractedQuestion> = emptyList(),
)
