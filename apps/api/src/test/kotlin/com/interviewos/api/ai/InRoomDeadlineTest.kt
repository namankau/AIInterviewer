package com.interviewos.api.ai

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper
import java.net.InetSocketAddress
import java.time.Duration
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * The mid-round stall (3 Oct 2026): a model that stops responding must not hold a candidate
 * for the shared three-minute timeout before the chain moves on.
 *
 * No model is called. A local HTTP server stands in for the Gemini endpoint, answering at
 * once for a model named "fast" and only after [SLOW_MS] for one named "slow".
 */
class InRoomDeadlineTest {
    private val objectMapper = ObjectMapper()
    private val prompts = PromptLibrary(objectMapper)
    private val handlers: ExecutorService = Executors.newCachedThreadPool()
    private val server: HttpServer =
        HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            executor = handlers
            createContext("/") { exchange ->
                exchange.requestBody.readAllBytes()
                val path = exchange.requestURI.path
                if ("slow" in path) {
                    runCatching { Thread.sleep(SLOW_MS) }
                }
                val body = if (path.endsWith(":generateContent") && "sandbox" in path) SANDBOX_RESPONSE else ASSESSMENT_RESPONSE
                val bytes = body.toByteArray()
                exchange.responseHeaders.add("Content-Type", "application/json")
                runCatching {
                    exchange.sendResponseHeaders(200, bytes.size.toLong())
                    exchange.responseBody.use { it.write(bytes) }
                }
            }
            start()
        }

    @AfterEach
    fun stop() {
        server.stop(0)
        handlers.shutdownNow()
    }

    @Test
    fun `an assessment that outlasts the in-room deadline fails fast and is worth retrying elsewhere`() {
        val primary = gemini("slow-lite", inRoomTimeout = Duration.ofMillis(300))

        val started = System.nanoTime()
        val failure = assertFailsWith<AiUnavailableException> { assess(primary) }
        val waitedMs = (System.nanoTime() - started) / 1_000_000

        assertTrue(failure.worthRetryingElsewhere, "a timeout is somebody else's failure, so the chain must move on")
        assertTrue("in time" in failure.message.orEmpty(), "the log should say slow, not broken: ${failure.message}")
        assertTrue(waitedMs < SLOW_MS - 1_000, "waited ${waitedMs}ms for a model that answers in ${SLOW_MS}ms")
    }

    @Test
    fun `the chain hands a stuck assessment to the model behind it`() {
        val chain =
            FallbackInterviewAi(
                listOf(
                    gemini("slow-lite", inRoomTimeout = Duration.ofMillis(300)),
                    gemini("fast-flash"),
                ),
            )

        val started = System.nanoTime()
        val assessment = assess(chain)
        val waitedMs = (System.nanoTime() - started) / 1_000_000

        assertEquals("Could you walk me through the cache?", assessment.value.nextQuestionText)
        assertEquals("fast-flash", assessment.usage.model)
        assertTrue(waitedMs < SLOW_MS - 1_000, "waited ${waitedMs}ms; the stuck primary was not cut off")
    }

    @Test
    fun `a provider with no in-room deadline still waits for a slow answer`() {
        val last = gemini("slow-flash")

        assertEquals("Could you walk me through the cache?", assess(last).value.nextQuestionText)
    }

    @Test
    fun `work nobody is waiting on in the room keeps the long timeout`() {
        // The deadline is for the candidate's silence, not every call the provider makes.
        // Running code is one of the calls it does not cover, like the report.
        val primary = gemini("slow-sandbox", inRoomTimeout = Duration.ofMillis(300))

        assertEquals(listOf("42\n"), primary.runPython("print(42)").value.outputs)
    }

    private fun gemini(
        model: String,
        inRoomTimeout: Duration? = null,
    ) = GeminiInterviewAi(
        properties = GeminiProperties(apiKey = "test-key", baseUrl = "http://127.0.0.1:${server.address.port}"),
        prompts = prompts,
        objectMapper = objectMapper,
        restClientBuilder = RestClient.builder(),
        reasoningModel = model,
        inRoomTimeout = inRoomTimeout,
    )

    private fun assess(ai: InterviewAi) =
        ai.assessAnswer(
            brief =
                InterviewBrief(
                    company = "Infosys",
                    archetype = "Service-based IT firm",
                    role = "Senior Backend Engineer",
                    roundType = "Project deep-dive",
                    roundCovers = "- what they personally decided",
                    language = "english",
                    candidateFunction = null,
                    candidateLevel = null,
                    targetLevel = null,
                    grounding = "archetype patterns",
                ),
            round =
                RoundContext(
                    phase = "main round",
                    minutesElapsed = 22,
                    minutesRemaining = 8,
                    durationMinutes = 30,
                    warmupInstruction = null,
                    briefTheCandidate = false,
                    mustConclude = false,
                ),
            priorTurns = emptyList(),
            currentQuestion = "What did you build?",
            answer = AnswerAudio(ByteArray(64), "audio/webm"),
        )

    private companion object {
        const val SLOW_MS = 4_000L

        val ASSESSMENT_RESPONSE =
            """
            {"candidates":[{"content":{"parts":[{"text":
              "{\"transcript\":\"I built a cache.\",\"suggestedNextAction\":\"follow_up\",\"intervention\":\"none\",\"nextQuestionText\":\"Could you walk me through the cache?\"}"
            }]}}]}
            """.trimIndent()

        val SANDBOX_RESPONSE =
            """
            {"candidates":[{"content":{"parts":[{"codeExecutionResult":{"output":"42\n"}}]}}]}
            """.trimIndent()
    }
}
