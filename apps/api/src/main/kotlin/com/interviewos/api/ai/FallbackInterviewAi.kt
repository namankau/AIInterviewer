package com.interviewos.api.ai

import org.slf4j.LoggerFactory

/**
 * Tries each provider in turn, and is honest about which ones it can try.
 *
 * The interview loop had a single point of failure: one Gemini project, one spend cap.
 * When that cap was reached the product stopped — no interviews could start, no reports
 * could be written, and the source library could not read anything.
 *
 * Two rules make this safe rather than merely redundant.
 *
 * **A provider is only offered work it can actually do.** Assessing an answer sends the
 * candidate's recorded voice; handing that to a text-only model would not degrade the
 * round, it would break it — at best an error, at worst an invented transcript scored as
 * though it were real. So each call names the capability it needs and the chain skips
 * anyone who lacks it. In practice that means the text-heavy calls can fail over to a
 * cheap text model, and answer assessment can only fail over to another *multimodal*
 * provider.
 *
 * **Only somebody else's failure is retried.** A quota refusal or an outage is worth
 * trying elsewhere. A malformed request is ours and will fail identically everywhere, so
 * it fails fast rather than being billed three times on the way to the same error.
 *
 * What this deliberately does not do is silently lower quality. Every fall-through is
 * logged with both providers named, and the provider that actually answered is what gets
 * recorded against the report — so "why is this report worse than that one" is always
 * answerable.
 */
class FallbackInterviewAi(
    private val providers: List<InterviewAi>,
) : InterviewAi {
    private val log = LoggerFactory.getLogger(javaClass)

    init {
        require(providers.isNotEmpty()) { "At least one AI provider must be configured." }
    }

    override val providerName: String = providers.joinToString(" → ") { it.providerName }

    override val capabilities: Set<AiCapability> = providers.flatMap { it.capabilities }.toSet()

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> =
        attempt(AiCapability.DOCUMENT_UNDERSTANDING, "parseResume") { it.parseResume(file) }

    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> = attempt(AiCapability.SPEECH_SYNTHESIS, "synthesizeSpeech") { it.synthesizeSpeech(text, language) }

    override fun composeRound(query: String): AiResult<ComposedRound> =
        attempt(AiCapability.STRUCTURED_TEXT, "composeRound") { it.composeRound(query) }

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> = attempt(AiCapability.STRUCTURED_TEXT, "composeOpeningQuestion") { it.composeOpeningQuestion(brief, round) }

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment> =
        // The one call that cannot fall back to a text model, however cheap.
        attempt(AiCapability.AUDIO_UNDERSTANDING, "assessAnswer") {
            it.assessAnswer(brief, round, priorTurns, currentQuestion, answer, video)
        }

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> =
        attempt(AiCapability.STRUCTURED_TEXT, "offerHint") { it.offerHint(brief, round, priorTurns, currentQuestion) }

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> =
        attempt(AiCapability.STRUCTURED_TEXT, "extractQuestions") { it.extractQuestions(source) }

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> = attempt(AiCapability.STRUCTURED_TEXT, "composeReport") { it.composeReport(brief, transcript) }

    private fun <T> attempt(
        capability: AiCapability,
        call: String,
        work: (InterviewAi) -> AiResult<T>,
    ): AiResult<T> {
        val able = providers.filter { capability in it.capabilities }
        if (able.isEmpty()) {
            throw AiUnavailableException(
                "No configured provider can do $call — it needs $capability.",
                worthRetryingElsewhere = false,
            )
        }

        var last: AiUnavailableException? = null
        for ((index, provider) in able.withIndex()) {
            try {
                val result = work(provider)
                if (index > 0) {
                    log.info("{} was served by {} after {} failed", call, provider.providerName, able[index - 1].providerName)
                }
                return result
            } catch (e: AiUnavailableException) {
                if (!e.worthRetryingElsewhere) throw e
                last = e
                val next = able.getOrNull(index + 1)
                if (next == null) {
                    log.warn("{} failed on {} and there is nobody left to ask", call, provider.providerName, e)
                } else {
                    log.warn("{} failed on {}; falling back to {}: {}", call, provider.providerName, next.providerName, e.message)
                }
            }
        }

        throw AiUnavailableException(
            "Every configured provider failed for $call. Last error: ${last?.message}",
            last,
        )
    }
}
