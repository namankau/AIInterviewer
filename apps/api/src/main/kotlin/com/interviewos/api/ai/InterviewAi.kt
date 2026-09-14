package com.interviewos.api.ai

/**
 * The interview AI, as the rest of the backend sees it. One provider (Google Gemini)
 * covers the whole loop — parsing the resume, speaking each question, understanding the
 * spoken answer, and composing the report — so there is no separate STT, TTS, or voice
 * vendor behind this (CLAUDE.md, verified 2026-08-25).
 *
 * Every method may throw [AiUnavailableException]. Callers degrade honestly on it: a
 * session whose model call fails becomes `failed`, never a fake pass (task 002, §5).
 */
interface InterviewAi {
    /**
     * A name for logs and for the `model` recorded against a report, so it is always
     * possible to tell which provider actually answered.
     */
    val providerName: String

    /**
     * What this provider can genuinely do. The fallback chain uses it to avoid handing a
     * text-only model a recording of somebody's voice.
     */
    val capabilities: Set<AiCapability>

    fun parseResume(file: ResumeFile): AiResult<ParsedResume>

    /**
     * Reads a candidate's one-line description of the interview they are preparing for
     * and turns it into the setup for a round.
     *
     * This reads their sentence. It does not research their employer: what a company's
     * process actually looks like is decided from the archetype, and a model inventing it
     * here would put a fabricated claim in front of the candidate before the round even
     * starts.
     */
    fun composeRound(query: String): AiResult<ComposedRound>

    fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio>

    /**
     * The coding problem a DSA round runs on. Composed once, at the start, and then fixed
     * — a candidate is not handed a different problem halfway through, and one
     * regenerated on a page reload would be exactly that.
     */
    fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedProblem>

    /** The case a system design round runs on. Composed once, like [composeProblem]. */
    fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedCase>

    /**
     * Runs [program] in the provider's code sandbox and returns what the sandbox printed.
     *
     * Only providers declaring [AiCapability.CODE_EXECUTION] implement this; the fallback
     * chain never offers it to anyone else, so the default is unreachable in practice and
     * says so if it is ever reached.
     */
    fun runPython(program: String): AiResult<SandboxRun> =
        throw AiUnavailableException("$providerName cannot run code.", worthRetryingElsewhere = true)

    fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion>

    /**
     * Judges one spoken answer. [video] is sent when the candidate consented to the
     * camera, so delivery is assessed on how they actually came across rather than on a
     * transcript alone; it is null when they declined, and the model is told to stay
     * silent about presence in that case.
     */
    fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment>

    /**
     * The nudge a candidate gets when they ask for help mid-question, plus the model's
     * own judgement of how much it gave away. That judgement is recorded against them:
     * help that is not counted is help that quietly inflates a report.
     */
    fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint>

    /**
     * Pulls the interview questions a document actually reports out of it.
     *
     * Extraction, not generation: a source with nothing in it returns an empty list. The
     * candidate is shown these next to a link to the page they came from, so a plausible
     * question the model wrote itself would be a lie with a citation attached.
     */
    fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions>

    /**
     * The general pattern for how loops run at a kind of employer, never a specific one.
     *
     * **[archetype] describes the employer; the company's own name is never in this
     * call.** That is the whole point: a model that never sees "Amazon" cannot invent an
     * Amazon-specific detail while writing this, however fluently it could if asked
     * directly. The result is cached per (archetype, role, level) — it is neither
     * personal nor about any one company, so the same answer is correct for everyone in
     * that bucket, and caching it is what keeps this call almost free.
     */
    fun composeLoopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): AiResult<GeneralLoopPattern>

    fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent>
}

/**
 * Thrown when a provider cannot be reached or returns something unusable.
 *
 * [worthRetryingElsewhere] is the whole basis of the fallback chain. A quota refusal, an
 * outage or a timeout is somebody else's problem and another provider may well succeed.
 * A malformed request is *ours*, and will fail identically everywhere — retrying it down
 * the chain would turn one fast error into three slow ones and bill for the privilege.
 */
class AiUnavailableException(
    message: String,
    cause: Throwable? = null,
    val worthRetryingElsewhere: Boolean = true,
) : RuntimeException(message, cause)
