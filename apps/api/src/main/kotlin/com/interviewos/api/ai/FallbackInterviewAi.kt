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
    /**
     * Where each answered call is written down. This is the only place in the codebase
     * that sees both the usage a call cost *and* whether it was served by the cheap
     * provider or the expensive one behind it, so it is the only place the two can be
     * recorded together.
     */
    private val recorder: AiSpendRecorder = AiSpendRecorder.NONE,
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

    override fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedProblem> = attempt(AiCapability.STRUCTURED_TEXT, "composeProblem") { it.composeProblem(brief, durationMinutes) }

    override fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedCase> = attempt(AiCapability.STRUCTURED_TEXT, "composeCase") { it.composeCase(brief, durationMinutes) }

    override fun runPython(program: String): AiResult<SandboxRun> =
        attempt(AiCapability.CODE_EXECUTION, "runPython") { it.runPython(program) }

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

    override fun composeLoopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): AiResult<GeneralLoopPattern> =
        attempt(AiCapability.STRUCTURED_TEXT, "composeLoopPattern") { it.composeLoopPattern(archetype, roleFamily, level) }

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> = attempt(AiCapability.STRUCTURED_TEXT, "composeReport") { it.composeReport(brief, transcript) }

    private fun <T> attempt(
        capability: AiCapability,
        call: String,
        work: (InterviewAi) -> AiResult<T>,
    ): AiResult<T> {
        val able =
            providers.filter { capability in it.capabilities }.let {
                if (capability in TRY_STRONGEST_FIRST) it.reversed() else it
            }
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
                val fellBackFrom = if (index > 0) able[index - 1].providerName else null
                if (fellBackFrom != null) {
                    log.info("{} was served by {} after {} failed", call, provider.providerName, fellBackFrom)
                }
                write(call, provider, result.usage, fellBackFrom)
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

    /**
     * Writes down what the call cost, and never lets that be the reason a round fails.
     *
     * Bookkeeping is not worth an interview. A candidate mid-round must not lose their
     * turn because a ledger insert deadlocked, so every failure here is swallowed with a
     * line in the log — the money is already spent whether or not the row lands.
     *
     * **The recorded figure is a lower bound when [fellBackFrom] is set.** A provider that
     * refused on quota was not billed and cost nothing, but one that answered with
     * unusable JSON was billed in full and its usage died with the exception. So a
     * fall-through costs *at least* what is written here, and the field naming it is the
     * flag to go and look.
     */
    private fun write(
        call: String,
        provider: InterviewAi,
        usage: AiUsage,
        fellBackFrom: String?,
    ) {
        try {
            val attribution = AiSpendContext.current()
            recorder.record(
                AiCallRecord(
                    call = call,
                    provider = provider.providerName,
                    usage = usage,
                    fellBackFrom = fellBackFrom,
                    microUsd = AiPrices.microUsd(usage),
                    userId = attribution?.userId,
                    sessionId = attribution?.sessionId,
                ),
            )
        } catch (e: RuntimeException) {
            log.warn("Could not record what {} on {} cost", call, provider.providerName, e)
        }
    }

    private companion object {
        /**
         * Capabilities where the chain's usual order is the wrong one.
         *
         * Providers are configured cheapest-first, which is right for anything a
         * candidate waits on many times in a round. Reading a resume is the opposite
         * case: it happens once per candidate, nobody is timing it, and the result
         * shapes every interview they ever sit here. A cheap model that misreads an
         * employer costs far more than the call it saved.
         *
         * This does assume the configured order runs cheap to strong. It does, and
         * `application.yml` says so where the order is set.
         */
        val TRY_STRONGEST_FIRST = setOf(AiCapability.DOCUMENT_UNDERSTANDING)
    }
}
