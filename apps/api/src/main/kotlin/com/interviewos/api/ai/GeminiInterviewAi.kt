package com.interviewos.api.ai

import com.interviewos.api.common.ContentTypes
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
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
@Component
class GeminiInterviewAi(
    private val properties: GeminiProperties,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder,
) : InterviewAi {
    private val restClient = restClientBuilder.build()

    override fun parseResume(file: ResumeFile): AiResult<ParsedResume> {
        val prompt = loadPrompt("resume-parse")
        val parts =
            listOf(
                textPart(prompt),
                inlineDataPart(file.contentType, file.bytes),
            )
        val (node, usage) = generateJson(properties.reasoningModel, parts, schema("resume-parse"))
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

    override fun composeOpeningQuestion(brief: InterviewBrief): AiResult<AskedQuestion> {
        val prompt = fillBrief(loadPrompt("opening-question"), brief)
        val (node, usage) = generateJson(properties.reasoningModel, listOf(textPart(prompt)), schema("opening-question"))
        return AiResult(objectMapper.treeToValue(node, AskedQuestion::class.java), usage)
    }

    override fun assessAnswer(
        brief: InterviewBrief,
        priorTurns: List<TurnTranscript>,
        currentQuestion: String,
        answer: AnswerAudio,
    ): AiResult<AnswerAssessment> {
        val history =
            priorTurns.joinToString("\n") { turn ->
                "Q: ${turn.questionText}\nA: ${turn.answerTranscript ?: "(no answer captured)"}"
            }
        val prompt =
            fillBrief(loadPrompt("assess-answer"), brief)
                .replace("{{currentQuestion}}", currentQuestion)
                .replace("{{history}}", history.ifBlank { "(this is the first answer)" })
        val parts = listOf(textPart(prompt), inlineDataPart(answer.contentType, answer.bytes))
        val (node, usage) = generateJson(properties.reasoningModel, parts, schema("assess-answer"))
        return AiResult(objectMapper.treeToValue(node, AnswerAssessment::class.java), usage)
    }

    override fun composeReport(
        brief: InterviewBrief,
        transcript: List<TurnTranscript>,
    ): AiResult<ReportContent> {
        val body =
            transcript
                .mapIndexed { index, turn ->
                    buildString {
                        append("Turn $index\nQ: ${turn.questionText}\n")
                        append("A: ${turn.answerTranscript ?: "(no answer captured)"}")
                        // Marked inline so the model cannot praise an answer it was
                        // handed without noticing that it handed it over.
                        if (turn.intervention.isAssisted) {
                            append("\n[interviewer intervened — ${turn.intervention.label.lowercase()}")
                            turn.interventionNote?.let { append(": $it") }
                            append("]")
                        }
                    }
                }.joinToString("\n\n")
        val prompt =
            fillBrief(loadPrompt("report"), brief)
                .replace("{{transcript}}", body)
                .replace("{{assistance}}", assistanceContext(transcript))
        val (node, usage) = generateJson(properties.reasoningModel, listOf(textPart(prompt)), schema("report"))
        return AiResult(objectMapper.treeToValue(node, ReportContent::class.java), usage)
    }

    /**
     * Counts of help given, so the model's narrative is built on the real numbers rather
     * than its own impression of how the round went.
     */
    private fun assistanceContext(transcript: List<TurnTranscript>): String {
        val answered = transcript.filter { it.answerTranscript != null }
        if (answered.isEmpty()) return "No answers were recorded."

        val assisted = answered.filter { it.intervention.isAssisted }
        if (assisted.isEmpty()) {
            return "The candidate answered all ${answered.size} questions without any help."
        }

        return buildString {
            append("The candidate answered ${answered.size - assisted.size} of ${answered.size} unaided. ")
            append("The interviewer stepped in on ${assisted.size}:\n")
            assisted
                .groupingBy { it.intervention }
                .eachCount()
                .forEach { (intervention, count) -> append("- ${intervention.label}: $count turn(s)\n") }
            assisted.mapNotNull { it.interventionNote }.forEach { append("- what was given: $it\n") }
        }
    }

    // ---------------------------------------------------------------------------
    // HTTP + parsing
    // ---------------------------------------------------------------------------

    private fun generateJson(
        model: String,
        parts: List<Map<String, Any>>,
        responseSchema: JsonNode,
    ): Pair<JsonNode, AiUsage> {
        requireConfigured()
        val body =
            mapOf(
                "contents" to listOf(mapOf("role" to "user", "parts" to parts)),
                "generationConfig" to
                    mapOf(
                        "responseMimeType" to "application/json",
                        "responseSchema" to responseSchema,
                        "temperature" to 0.7,
                    ),
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

    private fun requireConfigured() {
        if (!properties.configured) {
            throw AiUnavailableException("GEMINI_API_KEY is not set; the interview AI is unavailable.")
        }
    }

    private fun textPart(text: String): Map<String, Any> = mapOf("text" to text)

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

    private fun fillBrief(
        template: String,
        brief: InterviewBrief,
    ): String =
        template
            .replace("{{company}}", brief.company)
            .replace("{{archetype}}", brief.archetype)
            .replace("{{role}}", brief.role)
            .replace("{{roundType}}", brief.roundType)
            .replace("{{language}}", brief.language)
            .replace("{{candidateFunction}}", brief.candidateFunction ?: "unspecified")
            .replace("{{candidateLevel}}", brief.candidateLevel ?: "unspecified")
            .replace("{{targetLevel}}", brief.targetLevel ?: "unspecified")
            .replace("{{grounding}}", brief.grounding)

    private fun loadPrompt(name: String): String = readResource("ai/prompts/$name.md")

    private fun schema(name: String): JsonNode = objectMapper.readTree(readResource("ai/schemas/$name.json"))

    private fun readResource(path: String): String = ClassPathResource(path).inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
}
