package com.interviewos.api.pool

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID

class PoolExportTest {
    private val objectMapper = ObjectMapper()
    private val export = PoolExport(objectMapper)

    private fun row(
        association: String = "employer_kind",
        knowledgeBasis: String? = null,
        company: String? = "Amazon",
    ) = PoolExportRow(
        id = UUID.fromString("55555555-5555-5555-5555-555555555555"),
        companyName = company,
        companySlug = company?.lowercase(),
        archetype = "global_product",
        roundType = "hr_fit_closing",
        roleFamily = "backend",
        level = "mid",
        association = association,
        knowledgeBasis = knowledgeBasis,
        text = "Why this team, rather than the other four you applied to?",
        followUps = listOf("What would change your answer?", "What did you turn down?"),
        strongAnswerCovers = listOf("a reason specific to the work", "evidence they read something"),
        model = "gemini-3.1-flash-lite",
        generatorVersion = 1,
        createdAt = Instant.parse("2026-09-15T10:00:00Z"),
    )

    @Test
    fun `one question per line, each a complete JSON object`() {
        val rendered = export.render(listOf(row(), row(company = null)))

        val lines = rendered.trim().lines()
        assertThat(lines).hasSize(2)
        lines.forEach { line ->
            val parsed = objectMapper.readTree(line)
            assertThat(parsed.path("question").asString()).isNotBlank()
            assertThat(parsed.path("followUps").size()).isEqualTo(2)
        }
    }

    @Test
    fun `every line says what tier it is, because a line gets read out of context`() {
        val parsed = objectMapper.readTree(export.render(listOf(row())).trim())

        assertThat(parsed.path("provenance").asString()).isEqualTo("model_knowledge")
    }

    @Test
    fun `a company-specific line carries the account that earned it`() {
        // The reviewer's whole job is deciding whether that account is good enough. A file
        // that showed the label without the evidence would be unreviewable.
        val rendered =
            export.render(
                listOf(row(association = "company_specific", knowledgeBasis = "Their loop names a bar raiser round.")),
            )
        val parsed = objectMapper.readTree(rendered.trim())

        assertThat(parsed.path("association").asString()).isEqualTo("company_specific")
        assertThat(parsed.path("knowledgeBasis").asString()).contains("bar raiser")
    }

    @Test
    fun `prose with quotes and newlines survives the format`() {
        // The reason this is JSONL and not CSV: a model wrote the basis, and it contains
        // commas, quotes and line breaks as a matter of course.
        val awkward = "They call it a \"bar raiser\".\nIt is a separate interviewer, not on the team."
        val rendered = export.render(listOf(row(association = "company_specific", knowledgeBasis = awkward)))

        assertThat(rendered.trim().lines()).hasSize(1)
        assertThat(objectMapper.readTree(rendered.trim()).path("knowledgeBasis").asString()).isEqualTo(awkward)
    }

    @Test
    fun `an empty run renders an empty file rather than failing`() {
        assertThat(export.render(emptyList())).isEmpty()
    }
}
