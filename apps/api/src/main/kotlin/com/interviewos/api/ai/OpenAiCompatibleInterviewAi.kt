package com.interviewos.api.ai

import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * A fallback provider speaking the `/chat/completions` wire format.
 *
 * That format is the lingua franca: Moonshot (Kimi), DeepSeek, Groq, OpenRouter and
 * Together all serve it, so **one adapter buys the whole field** and switching vendors is
 * a base URL and a model id in configuration rather than a code change. No SDK is added
 * for it — it is one POST with a JSON body, and a dependency per vendor would be absurd.
 *
 * To be clear about `CLAUDE.md`'s "do not use Anthropic or OpenAI here": this speaks a
 * format OpenAI published, it does not call OpenAI. Which vendor is actually configured
 * is entirely a matter of the base URL.
 *
 * **Text only, deliberately.** It declares [AiCapability.STRUCTURED_TEXT] and nothing
 * else. These models cannot hear a recording, and the assessment call that carries the
 * candidate's voice must never be routed here — see [FallbackInterviewAi].
 */
class OpenAiCompatibleInterviewAi(
    private val config: ProviderConfig,
    private val prompts: PromptLibrary,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder,
) : InterviewAi {
    private val restClient = restClientBuilder.build()

    override val providerName: String = "${config.name} (${config.model})"

    override val capabilities: Set<AiCapability> = setOf(AiCapability.STRUCTURED_TEXT)

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> = unsupported("reading a resume file")

    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> = unsupported("speaking a question aloud")

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment> = unsupported("listening to a spoken answer")

    override fun composeRound(query: String): AiResult<ComposedRound> =
        complete(prompts.composeRound(query), "compose-round", ComposedRound::class.java)

    override fun composeProblem(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedProblem> = complete(prompts.composeProblem(brief, durationMinutes), "compose-problem", ComposedProblem::class.java)

    override fun composeCase(
        brief: InterviewBrief,
        durationMinutes: Int,
    ): AiResult<ComposedCase> = complete(prompts.composeCase(brief, durationMinutes), "compose-case", ComposedCase::class.java)

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> = complete(prompts.openingQuestion(brief, round), "opening-question", AskedQuestion::class.java)

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> = complete(prompts.offerHint(brief, round, priorTurns, currentQuestion), "offer-hint", OfferedHint::class.java)

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> =
        complete(prompts.extractQuestions(source), "extract-questions", ExtractedQuestions::class.java)

    override fun composeLoopPattern(
        archetype: String,
        roleFamily: String,
        level: String,
    ): AiResult<GeneralLoopPattern> =
        complete(prompts.loopPattern(archetype, roleFamily, level), "general-loop-pattern", GeneralLoopPattern::class.java)

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> = complete(prompts.report(brief, transcript), "report", ReportContent::class.java)

    private fun <T> complete(
        prompt: String,
        schemaName: String,
        type: Class<T>,
    ): AiResult<T> {
        /*
         * `json_object` rather than a strict schema. Support for `json_schema` varies by
         * vendor and a request rejected for an unsupported response format is a fallback
         * that does not fall back — so the schema goes in the prompt, where every model
         * understands it, and the shape is enforced by parsing the result.
         */
        val body =
            mapOf(
                "model" to config.model,
                "temperature" to 0.7,
                "response_format" to mapOf("type" to "json_object"),
                "messages" to
                    listOf(
                        mapOf(
                            "role" to "system",
                            "content" to
                                "You return only JSON conforming to this schema, with no commentary " +
                                "and no markdown fence:\n${prompts.schemaText(schemaName)}",
                        ),
                        mapOf("role" to "user", "content" to prompt),
                    ),
            )

        val response = call(body)
        val content =
            response
                .path("choices")
                .path(0)
                .path("message")
                .path("content")
                .asString()
        if (content.isNullOrBlank()) {
            throw AiUnavailableException("${config.name} returned an empty completion.")
        }

        val parsed =
            try {
                objectMapper.readValue(stripFence(content), type)
            } catch (e: RuntimeException) {
                // The model answered but not in the shape we need. Another provider might
                // do better, so this is worth passing down the chain.
                throw AiUnavailableException("${config.name} returned JSON we could not read.", e)
            }

        val usage = response.path("usage")
        return AiResult(
            parsed,
            AiUsage(
                model = config.model,
                promptTokens = usage.path("prompt_tokens").asInt(0),
                outputTokens = usage.path("completion_tokens").asInt(0),
            ),
        )
    }

    private fun call(body: Map<String, Any>): JsonNode =
        try {
            restClient
                .post()
                .uri("${config.baseUrl.trimEnd('/')}/chat/completions")
                .header("Authorization", "Bearer ${config.apiKey}")
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(JsonNode::class.java)
                ?: throw AiUnavailableException("${config.name} returned no body.")
        } catch (e: HttpClientErrorException.TooManyRequests) {
            throw AiUnavailableException("${config.name} is rate-limited or out of quota.", e)
        } catch (e: HttpClientErrorException) {
            // A 4xx that is not a quota refusal is our request being wrong, and it will
            // be just as wrong at the next provider.
            throw AiUnavailableException(
                "${config.name} rejected the request: ${e.statusCode}.",
                e,
                worthRetryingElsewhere = false,
            )
        } catch (e: HttpServerErrorException) {
            throw AiUnavailableException("${config.name} is having problems: ${e.statusCode}.", e)
        } catch (e: RestClientException) {
            throw AiUnavailableException("${config.name} could not be reached.", e)
        }

    /** Models fence JSON in markdown however firmly they are told not to. */
    private fun stripFence(content: String): String {
        val trimmed = content.trim()
        if (!trimmed.startsWith("```")) return trimmed
        return trimmed
            .removePrefix("```json")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()
    }

    private fun unsupported(what: String): Nothing =
        throw AiUnavailableException(
            "${config.name} cannot do $what; it is a text-only fallback.",
            worthRetryingElsewhere = false,
        )
}

/** One configured provider. The vendor is decided entirely by [baseUrl]. */
data class ProviderConfig(
    val name: String = "",
    val kind: String = "gemini",
    val baseUrl: String = "",
    val model: String = "",
    val apiKey: String = "",
) {
    val configured: Boolean
        get() = apiKey.isNotBlank() && model.isNotBlank()
}
