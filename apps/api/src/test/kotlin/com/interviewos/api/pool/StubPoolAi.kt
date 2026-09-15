package com.interviewos.api.pool

import com.interviewos.api.ai.AiCapability
import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.AnswerVideo
import com.interviewos.api.ai.AskedQuestion
import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.ComposedRound
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.ExtractedQuestions
import com.interviewos.api.ai.GeneralLoopPattern
import com.interviewos.api.ai.GeneratedQuestions
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.OfferedHint
import com.interviewos.api.ai.ParsedResume
import com.interviewos.api.ai.PoolQuestionRequest
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.ai.ResumeFile
import com.interviewos.api.ai.RoundContext
import com.interviewos.api.ai.SourceDocument
import com.interviewos.api.ai.SpokenAudio
import com.interviewos.api.ai.TextEmbeddings
import com.interviewos.api.ai.TurnTranscript

/**
 * The AI boundary, stubbed. **No test in this package makes a live model call** — the
 * pool's whole job is spending money on Gemini, which is exactly why none of it is
 * exercised against the real thing here (CLAUDE.md rule 7).
 *
 * Everything the pool does not use throws, so a test that accidentally reaches one of them
 * fails loudly rather than quietly asserting against a default.
 */
abstract class StubPoolAi : InterviewAi {
    override val providerName: String = "stub"

    override val capabilities: Set<AiCapability> = AiCapability.entries.toSet()

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> = unsupported()

    override fun composeRound(query: String): AiResult<ComposedRound> = unsupported()

    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> = unsupported()

    override fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedProblem> = unsupported()

    override fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedCase> = unsupported()

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> = unsupported()

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment> = unsupported()

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> = unsupported()

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> = unsupported()

    override fun composeLoopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): AiResult<GeneralLoopPattern> = unsupported()

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> = unsupported()

    override fun assessEmployerKnowledge(
        companyName: String,
        archetype: String,
    ): AiResult<EmployerKnowledge> = unsupported()

    override fun generatePoolQuestions(request: PoolQuestionRequest): AiResult<GeneratedQuestions> = unsupported()

    override fun embed(
        texts: List<String>,
        model: String,
        dimensions: Int,
    ): AiResult<TextEmbeddings> = unsupported()

    protected fun unsupported(): Nothing = throw UnsupportedOperationException("not part of this test")
}
