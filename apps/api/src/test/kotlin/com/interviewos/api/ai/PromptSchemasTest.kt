package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import tools.jackson.databind.ObjectMapper

/**
 * Every response schema under `ai/schemas/` must be valid, loadable JSON.
 *
 * `PromptLibrary.schema` reads these at call time, and nothing else in the test suite
 * exercises most of them directly -- `extractQuestions` is mocked at the `InterviewAi`
 * boundary everywhere it is used, so a malformed schema file passed CI once and only
 * broke in a live call. This is the backstop: every file in the directory must parse,
 * whether or not anything else in the suite happens to load it by name.
 */
class PromptSchemasTest {
    private val objectMapper = ObjectMapper()

    @Test
    fun `every schema file is valid JSON`() {
        val resources =
            PathMatchingResourcePatternResolver()
                .getResources("classpath*:ai/schemas/*.json")
        assertThat(resources).isNotEmpty()

        resources.forEach { resource ->
            val text = resource.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
            val node =
                runCatching { objectMapper.readTree(text) }
                    .getOrElse { throw AssertionError("${resource.filename} is not valid JSON", it) }
            assertThat(node.get("type").asText()).isEqualTo("OBJECT")
        }
    }
}
