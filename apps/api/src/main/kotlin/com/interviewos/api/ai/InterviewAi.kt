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

    fun composeOpeningQuestion(brief: InterviewBrief): AiResult<AskedQuestion>

    fun assessAnswer(
        brief: InterviewBrief,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
    ): AiResult<AnswerAssessment>

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
