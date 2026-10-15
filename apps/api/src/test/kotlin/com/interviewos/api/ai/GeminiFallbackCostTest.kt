package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeminiFallbackCostTest {
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    private val baseUrl = "https://gemini.example/v1beta"
    private val model = "reasoning-model"

    private fun client(builder: RestClient.Builder): GeminiInterviewAi =
        GeminiInterviewAi(
            GeminiProperties(apiKey = "test-key", baseUrl = baseUrl),
            PromptLibrary(mapper),
            mapper,
            builder,
            model,
        )

    @Test
    fun `client errors other than request timeout and rate limit cannot fall through`() {
        for (status in listOf(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND, HttpStatus.UNPROCESSABLE_ENTITY)) {
            val builder = RestClient.builder()
            val server = MockRestServiceServer.bindTo(builder).build()
            server
                .expect(requestTo("$baseUrl/models/$model:generateContent"))
                .andRespond(withStatus(status).body("{}").contentType(MediaType.APPLICATION_JSON))

            val error = assertFailsWith<AiUnavailableException> { client(builder).composeRound("Java interview") }
            assertFalse(error.worthRetryingElsewhere, "${status.value()} must not raise the model bill")
            server.verify()
        }
    }

    @Test
    fun `request timeout and rate limit remain eligible for provider fallback`() {
        for (status in listOf(HttpStatus.REQUEST_TIMEOUT, HttpStatus.TOO_MANY_REQUESTS)) {
            val builder = RestClient.builder()
            val server = MockRestServiceServer.bindTo(builder).build()
            server
                .expect(requestTo("$baseUrl/models/$model:generateContent"))
                .andRespond(withStatus(status).body("{}").contentType(MediaType.APPLICATION_JSON))

            val error = assertFailsWith<AiUnavailableException> { client(builder).composeRound("Java interview") }
            assertTrue(error.worthRetryingElsewhere, "${status.value()} should be recoverable")
            server.verify()
        }
    }

    @Test
    fun `malformed JSON is retried once on the same model before fallback`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val malformed = """{"candidates":[{"content":{"parts":[{"text":"not JSON"}]}}]}"""
        repeat(2) {
            server
                .expect(requestTo("$baseUrl/models/$model:generateContent"))
                .andRespond(withSuccess(malformed, MediaType.APPLICATION_JSON))
        }

        val error = assertFailsWith<AiUnavailableException> { client(builder).composeRound("Java interview") }
        assertTrue(error.worthRetryingElsewhere)
        assertTrue(error.message!!.contains("twice"))
        server.verify()
    }

    @Test
    fun `a valid second response completes without a stronger model`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val malformed = """{"candidates":[{"content":{"parts":[{"text":"not JSON"}]}}]}"""
        val valid =
            """{"candidates":[{"content":{"parts":[{"text":"{\"company\":\"Example\",\"role\":\"Engineer\",\"level\":\"mid\",\"roundType\":\"technical_fundamentals\",\"durationMinutes\":30,\"language\":\"english\",\"understood\":\"Java interview\",\"assumptions\":[],\"confidence\":\"high\"}"}]}}]}"""
        server
            .expect(requestTo("$baseUrl/models/$model:generateContent"))
            .andRespond(withSuccess(malformed, MediaType.APPLICATION_JSON))
        server
            .expect(requestTo("$baseUrl/models/$model:generateContent"))
            .andRespond(withSuccess(valid, MediaType.APPLICATION_JSON))

        val result = client(builder).composeRound("Java interview")
        assertEquals("Example", result.value.company)
        server.verify()
    }
}
