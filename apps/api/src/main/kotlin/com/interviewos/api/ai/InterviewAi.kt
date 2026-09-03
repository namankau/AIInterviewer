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
    fun parseResume(file: ResumeFile): AiResult<ParsedResume>

    fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio>

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

    fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent>
}

/** Thrown when Gemini cannot be reached or returns something unusable. */
class AiUnavailableException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
