package com.interviewos.api.ai

import com.interviewos.api.common.ContentTypes
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.util.Base64

/**
 * Google Gemini as the whole interview loop's AI: resume parsing and answer
 * understanding and scoring on `gemini-3.5-flash`, the interviewer's spoken voice on
 * `gemini-2.5-flash-preview-tts`. Prompts and response schemas live in
 * `src/main/resources/ai/` so they are reviewable in version control, not buried in
 * string literals.
 *
 * This class is the boundary. Everything it returns is mocked in tests — no test calls
 * a live model. When the key is absent or a call fails, it raises
 * [AiUnavailableException] so callers can degrade honestly rather than fake a result.
 */
class GeminiInterviewAi(
    private val properties: GeminiProperties,
    private val prompts: PromptLibrary,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder,
    /**
     * Which Gemini model this instance uses for reasoning.
     *
     * Passed in rather than read from configuration, so one fallback chain can hold
     * several Gemini tiers — a cheap one first and a stronger one behind it, both able to
     * hear a recording, which no text-only fallback can.
     */
    private val reasoningModel: String,
) : InterviewAi {
    private val restClient = restClientBuilder.build()

    override val providerName: String = "gemini ($reasoningModel)"

    /**
     * Gemini is the only configured provider that can hear a recording or read a PDF, so
     * it is the only possible home for answer assessment and resume parsing. A text-only
     * fallback can take the rest.
     */
    override val capabilities: Set<AiCapability> =
        setOf(
            AiCapability.STRUCTURED_TEXT,
            AiCapability.AUDIO_UNDERSTANDING,
            AiCapability.DOCUMENT_UNDERSTANDING,
            AiCapability.SPEECH_SYNTHESIS,
        )

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> {
        val prompt = prompts.resumeParse()
        val parts =
            listOf(
                textPart(prompt),
                inlineDataPart(file.contentType, file.bytes),
            )
        val (node, usage) = generateJson(reasoningModel, parts, prompts.schema("resume-parse"))
        return AiResult(objectMapper.treeToValue(node, ParsedResume::class.java), usage)
    }

    override fun synthesizeSpeech(
        text: String,
        language: String,
    ): AiResult<SpokenAudio> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to listOf(mapOf("parts" to listOf(mapOf("text" to text)))),
                "generationConfig" to
                    mapOf(
                        "responseModalities" to listOf("AUDIO"),
                        "speechConfig" to
                            mapOf(
                                "voiceConfig" to
                                    mapOf(
                                        "prebuiltVoiceConfig" to mapOf("voiceName" to properties.voiceName),
                                    ),
                            ),
                    ),
            )
        val response = call(properties.speechModel, body)
        val inline =
            response
                .path("candidates")
                .path(0)
                .path("content")
                .path("parts")
                .path(0)
                .path("inlineData")
        val data = inline.path("data").asString()
        if (data.isNullOrBlank()) throw AiUnavailableException("Gemini returned no audio for the question.")
        val mimeType = inline.path("mimeType").asString()?.takeIf { it.isNotBlank() } ?: "audio/L16;rate=24000"
        return AiResult(playable(Base64.getDecoder().decode(data), mimeType), usageOf(response, properties.speechModel))
    }

    /**
     * Speech leaves here in a form a browser can actually play. Gemini returns headerless
     * PCM, which every `<audio>` element refuses, so it is wrapped in a WAV container
     * before anyone stores or signs a URL for it.
     */
    private fun playable(
        bytes: ByteArray,
        mimeType: String,
    ): SpokenAudio =
        if (WavAudio.isRawPcm(mimeType)) {
            SpokenAudio(WavAudio.wrap(bytes, WavAudio.sampleRateOf(mimeType)), "audio/wav")
        } else {
            SpokenAudio(bytes, ContentTypes.base(mimeType))
        }

    override fun composeRound(query: String): AiResult<ComposedRound> {
        val prompt = prompts.composeRound(query)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("compose-round"))
        return AiResult(objectMapper.treeToValue(node, ComposedRound::class.java), usage)
    }

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> {
        val prompt = prompts.openingQuestion(brief, round)
        val (node, usage) =
            generateJson(
                reasoningModel,
                listOf(textPart(prompt)),
                prompts.schema("opening-question"),
                Thinking.IN_THE_ROOM,
            )
        return AiResult(objectMapper.treeToValue(node, AskedQuestion::class.java), usage)
    }

    override fun assessAnswer(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
        video: AnswerVideo?,
    ): AiResult<AnswerAssessment> {
        val prompt = prompts.assessAnswer(brief, round, priorTurns, currentQuestion)

        val parts =
            buildList {
                add(textPart(prompt))
                add(inlineDataPart(answer.contentType, answer.bytes))
                // Inline parts share one request budget, so an oversized take is dropped
                // rather than allowed to fail the turn. Delivery falls back to the audio.
                video?.takeIf { it.bytes.size <= MAX_INLINE_VIDEO_BYTES }?.let {
                    add(inlineDataPart(it.contentType, it.bytes))
                }
            }
        val (node, usage) = generateJson(reasoningModel, parts, prompts.schema("assess-answer"), Thinking.IN_THE_ROOM)
        return AiResult(objectMapper.treeToValue(node, AnswerAssessment::class.java), usage)
    }

    override fun offerHint(
        brief: InterviewBrief,
        round: RoundContext,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
    ): AiResult<OfferedHint> {
        val prompt = prompts.offerHint(brief, round, priorTurns, currentQuestion)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("offer-hint"), Thinking.IN_THE_ROOM)
        return AiResult(objectMapper.treeToValue(node, OfferedHint::class.java), usage)
    }

    override fun extractQuestions(source: SourceDocument): AiResult<ExtractedQuestions> {
        val prompt = prompts.extractQuestions(source)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("extract-questions"))
        return AiResult(objectMapper.treeToValue(node, ExtractedQuestions::class.java), usage)
    }

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> {
        val prompt = prompts.report(brief, transcript)
        val (node, usage) = generateJson(reasoningModel, listOf(textPart(prompt)), prompts.schema("report"))
        return AiResult(objectMapper.treeToValue(node, ReportContent::class.java), usage)
    }

    // ---------------------------------------------------------------------------
    // HTTP + parsing
    // ---------------------------------------------------------------------------

    /**
     * @param thinkingBudget tokens the model may spend reasoning before it answers, or
     *   null to leave it unbounded. See [Thinking].
     */
    private fun generateJson(
        model: String,
        parts: List<Map<String, Any>>,
        responseSchema: JsonNode,
        thinkingBudget: Int? = null,
    ): Pair<JsonNode, AiUsage> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to listOf(mapOf("role" to "user", "parts" to parts)),
                "generationConfig" to
                    buildMap<String, Any> {
                        put("responseMimeType", "application/json")
                        put("responseSchema", responseSchema)
                        put("temperature", 0.7)
                        thinkingBudget?.let { put("thinkingConfig", mapOf("thinkingBudget" to it)) }
                    },
            )
        val response = call(model, body)
        val text =
            response
                .path("candidates")
                .path(0)
                .path("content")
                .path("parts")
                .path(0)
                .path("text")
                .asString()
        if (text.isNullOrBlank()) throw AiUnavailableException("Gemini returned an empty response for $model.")
        val parsed =
            runCatching { objectMapper.readTree(text) }
                .getOrElse { throw AiUnavailableException("Gemini returned malformed JSON for $model.", it) }
        return parsed to usageOf(response, model)
    }

    private fun call(
        model: String,
        body: Map<String, Any>,
    ): JsonNode =
        try {
            restClient
                .post()
                .uri("${properties.baseUrl}/models/$model:generateContent")
                .header("x-goog-api-key", properties.apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode::class.java)
                ?: throw AiUnavailableException("Gemini returned no body for $model.")
        } catch (ex: HttpClientErrorException.TooManyRequests) {
            // Worth telling apart from every other failure. A 429 here is usually the
            // project's spend cap rather than request rate, and the two need completely
            // different actions from whoever reads the log: one is "wait", the other is
            // "go and raise the cap". Being told only that the model "failed" sends them
            // looking for a bug that is not there.
            val quota = ex.responseBodyAsString.contains("spending cap", ignoreCase = true)
            throw AiUnavailableException(
                if (quota) {
                    "Gemini refused the request: the project has exceeded its spend cap. " +
                        "Raise it at https://ai.studio/spend — this is billing, not a fault in the request."
                } else {
                    "Gemini is rate-limiting requests to $model."
                },
                ex,
            )
        } catch (ex: RestClientException) {
            throw AiUnavailableException("Gemini request to $model failed.", ex)
        }

    private fun usageOf(
        response: JsonNode,
        model: String,
    ): AiUsage {
        val usage = response.path("usageMetadata")
        return AiUsage(
            model = model,
            promptTokens = usage.path("promptTokenCount").asInt(0),
            outputTokens = usage.path("candidatesTokenCount").asInt(0),
        )
    }

    /**
     * How long the model may think before answering.
     *
     * Measured against live Gemini on a real assessment, three runs each:
     *
     * | thinking  | latency | still challenged a weak answer |
     * |-----------|---------|--------------------------------|
     * | unbounded | 7.1s    | yes                            |
     * | 256       | 3.0s    | yes                            |
     * | 0         | 1.8s    | yes                            |
     *
     * Thinking was not buying quality on this call — every budget pushed back on
     * "it was mostly fine, nobody complained much", and the unbounded one was not the
     * sharpest of them. So the calls a candidate is sitting in silence waiting for do
     * not pay for it.
     *
     * The report is left unbounded deliberately: nobody is waiting on it in real time,
     * it reasons over a whole transcript rather than one answer, and it is the thing
     * they came for.
     */
    private object Thinking {
        /** Anything the candidate waits on mid-round: the question, the follow-up, a hint. */
        const val IN_THE_ROOM = 0
    }

    private fun requireConfigured() {
        if (!properties.configured) {
            throw AiUnavailableException("GEMINI_API_KEY is not set; the interview AI is unavailable.")
        }
    }

    private fun textPart(text: String): Map<String, Any> = mapOf("text" to text)

    private companion object {
        /**
         * Gemini caps a single request's inline payload at 20 MB. Answers are short, so a
         * take larger than this is a runaway recorder rather than a thorough candidate.
         */
        const val MAX_INLINE_VIDEO_BYTES = 15 * 1024 * 1024
        const val WARMUP_PHASE = "warm-up"
        const val CLOSING_PHASE = "closing"
    }

    private fun inlineDataPart(
        contentType: String,
        bytes: ByteArray,
    ): Map<String, Any> =
        mapOf(
            "inlineData" to
                mapOf(
                    "mimeType" to contentType,
                    "data" to Base64.getEncoder().encodeToString(bytes),
                ),
        )

    private fun readResource(path: String): String = ClassPathResource(path).inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
}
