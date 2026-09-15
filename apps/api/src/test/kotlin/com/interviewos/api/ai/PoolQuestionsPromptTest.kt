package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

/**
 * Task 037's lesson, applied to task 041's addition to `pool-questions.md`/`.json`: load and
 * fill the prompt for real, and round-trip the schema's new `valueClaimed` field, so a
 * malformed template or a schema that silently drops the field fails here rather than in a
 * live run nobody is watching (CLAUDE.md rule 7 -- no live call is made; this only exercises
 * [PromptLibrary] and Jackson).
 */
class PoolQuestionsPromptTest {
    private val library = PromptLibrary(ObjectMapper())

    @Test
    fun `every placeholder is filled for a company-specific cell`() {
        val request =
            PoolQuestionRequest(
                companyName = "Amazon",
                archetype = "Global product company",
                roundType = "Behavioural and competency",
                roleFamily = "Backend engineering",
                level = "Mid level",
                roundGuidance = "Ask STAR questions.",
                count = 3,
                avoid = listOf("Tell me about a time you disagreed with a peer."),
                knowledge =
                    EmployerKnowledge(
                        knowsProcess = true,
                        basis = "Publishes leadership principles.",
                        namedValues = listOf("Customer Obsession", "Ownership"),
                    ),
            )

        val prompt = library.poolQuestions(request)

        assertThat(prompt).doesNotContain("{{")
        assertThat(prompt).contains("Amazon", "Customer Obsession", "Ownership", "3")
    }

    @Test
    fun `every placeholder is filled for an archetype-level cell with no company and no avoid list`() {
        val request =
            PoolQuestionRequest(
                companyName = null,
                archetype = "Service-based IT firm",
                roundType = "HR, fit and closing",
                roleFamily = "QA and test automation",
                level = "Entry level",
                roundGuidance = "Ask HR questions.",
                count = 2,
                avoid = emptyList(),
                knowledge = null,
            )

        val prompt = library.poolQuestions(request)

        assertThat(prompt).doesNotContain("{{")
        assertThat(prompt).contains("not given", "kind of employer")
    }

    @Test
    fun `a question with valueClaimed round-trips through the schema-shaped JSON`() {
        val objectMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
        val question =
            GeneratedQuestion(
                text = "Tell me about a time you obsessed over a customer's problem.",
                followUps = listOf("What changed?", "What was the result?"),
                strongAnswerCovers = listOf("a concrete change"),
                companySpecific = true,
                valueClaimed = "Customer Obsession",
            )

        val json = objectMapper.writeValueAsString(GeneratedQuestions(listOf(question)))
        val roundTripped = objectMapper.readValue(json, GeneratedQuestions::class.java)

        assertThat(roundTripped.questions.single().valueClaimed).isEqualTo("Customer Obsession")
    }

    @Test
    fun `a response with no valueClaimed at all still parses -- the field is optional`() {
        val objectMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
        val json =
            """
            {"questions":[{"text":"Why us?","followUps":["A","B"],"strongAnswerCovers":["x"],"companySpecific":false}]}
            """.trimIndent()

        val parsed = objectMapper.readValue(json, GeneratedQuestions::class.java)

        assertThat(parsed.questions.single().valueClaimed).isNull()
    }

    @Test
    fun `the pool-questions schema accepts valueClaimed as an optional string property`() {
        val schema = library.schema("pool-questions")
        val itemProperties = schema["properties"]["questions"]["items"]["properties"]

        assertThat(itemProperties.has("valueClaimed")).isTrue()
        assertThat(itemProperties["valueClaimed"]["type"].asText()).isEqualTo("STRING")

        val required = schema["properties"]["questions"]["items"]["required"]
        val requiredNames = (0 until required.size()).map { required[it].asText() }
        assertThat(requiredNames).doesNotContain("valueClaimed")
    }
}
