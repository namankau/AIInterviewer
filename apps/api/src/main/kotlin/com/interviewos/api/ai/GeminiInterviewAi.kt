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

    override fun composeOpeningQuestion(
        brief: InterviewBrief,
        round: RoundContext,
    ): AiResult<AskedQuestion> {
        val prompt = fillRound(fillBrief(loadPrompt("opening-question"), brief), round)
        val (node, usage) = generateJson(properties.reasoningModel, listOf(textPart(prompt)), schema("opening-question"))
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
        val history =
            priorTurns.joinToString("\n") { turn ->
                "Q: ${turn.questionText}\nA: ${turn.answerTranscript ?: "(no answer captured)"}"
            }
        val prompt =
            fillRound(fillBrief(loadPrompt("assess-answer"), brief), round)
                .replace("{{currentQuestion}}", currentQuestion)
                .replace("{{history}}", history.ifBlank { "(this is the first answer)" })

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
                        append("Turn $index${if (turn.warmUp) " (warm-up)" else ""}\n")
                        append("Q: ${turn.questionText}\n")
                        append("A: ${turn.answerTranscript ?: "(no answer captured)"}")
                        turn.deliveryNote?.let { append("\n[delivery observed: $it]") }
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
     * Fills in where the round is up to, and what that means the interviewer should be
     * doing now. The pacing sentence is written here rather than left to the model,
     * because a model asked to pace itself will neither warm up nor wrap up.
     */
    private fun fillRound(
        template: String,
        round: RoundContext,
    ): String =
        template
            .replace("{{phase}}", round.phase)
            .replace("{{minutesElapsed}}", round.minutesElapsed.toString())
            .replace("{{minutesRemaining}}", round.minutesRemaining.toString())
            .replace("{{durationMinutes}}", round.durationMinutes.toString())
            .replace("{{pacing}}", pacingFor(round))

    private fun pacingFor(round: RoundContext): String =
        when {
            round.mustConclude -> {
                "The time is up. Close the interview off on this turn: thank them, tell them what happens " +
                    "next, and set `suggestedNextAction` to `conclude`. Do not open a new line of questioning."
            }

            round.briefTheCandidate -> {
                "The warm-up is over and you now know who you are talking to. Before your next question, " +
                    "tell them how the rest of the round will run - that there are about " +
                    "${round.minutesRemaining} minutes left, roughly what you will cover given this round " +
                    "type, that you want them to think out loud, and that they can ask you to repeat or " +
                    "clarify anything. Two or three sentences, spoken plainly. Then ask your first " +
                    "substantive question in the same turn."
            }

            round.phase == CLOSING_PHASE -> {
                "Only ${round.minutesRemaining} minutes remain. Do not open new ground. Finish the thread " +
                    "you are on, or ask one last question you can get a complete answer to."
            }

            round.phase == WARMUP_PHASE -> {
                "You are still warming up. Find out who they are: their background, something they built " +
                    "and are proud of, and what they actually work in day to day. Follow what they say - " +
                    "this is where you learn what is worth probing later. No hard questions yet."
            }

            else -> {
                "You are in the main round with ${round.minutesRemaining} minutes left. Pace yourself so " +
                    "the round finishes properly rather than being cut off mid-answer."
            }
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
