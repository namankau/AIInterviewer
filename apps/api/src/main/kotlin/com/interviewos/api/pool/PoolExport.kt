package com.interviewos.api.pool

import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * Renders a run's questions as JSON Lines, one question per line.
 *
 * **JSONL rather than CSV**, and the reason is the shape of the data rather than taste.
 * Every question carries two lists — its follow-ups and what a strong answer covers — and
 * a paragraph of free text in `knowledgeBasis` that will contain commas, quotes and
 * newlines because a model wrote it. CSV handles all of that only by flattening the lists
 * into some private separator and escaping the prose, and the first spreadsheet that opens
 * the result will mangle it. JSONL keeps the structure, needs no escaping convention
 * anybody has to remember, streams line by line, and survives a truncated file with every
 * complete line still readable. `jq` reads it directly, which is what the owner will
 * actually do with it.
 *
 * Every line carries `association` and, where there is one, `knowledgeBasis` — the reviewer
 * has to be able to see which questions claim to be about the employer and what the model
 * said to earn that, because that judgement is the entire point of reviewing the pool
 * before a candidate sees any of it.
 */
@Component
class PoolExport(
    private val objectMapper: ObjectMapper,
) {
    fun render(rows: List<PoolExportRow>): String =
        buildString {
            rows.forEach { row ->
                append(objectMapper.writeValueAsString(line(row)))
                append('\n')
            }
        }

    /**
     * The exported shape, spelled out rather than serialising the row object.
     *
     * A field renamed in the database would silently rename itself in every export the
     * owner has already filed, and `id` here is a database id nobody reading the file needs
     * — so the file's shape is stated once, here, and changes only on purpose.
     */
    private fun line(row: PoolExportRow): Map<String, Any?> =
        linkedMapOf(
            "id" to row.id.toString(),
            "company" to row.companyName,
            "companySlug" to row.companySlug,
            "archetype" to row.archetype,
            "roundType" to row.roundType,
            "roleFamily" to row.roleFamily,
            "level" to row.level,
            "association" to row.association,
            "knowledgeBasis" to row.knowledgeBasis,
            "question" to row.text,
            "followUps" to row.followUps,
            "strongAnswerCovers" to row.strongAnswerCovers,
            "model" to row.model,
            "generatorVersion" to row.generatorVersion,
            // Round-type-specific detail — a coding problem's starters and tests, a design
            // case's constraints and its LLD/distributed tag (task 040). Null for round
            // types with nothing beyond the shared columns above.
            "payload" to row.payload,
            "generatedAt" to row.createdAt.toString(),
            // Stated on every line rather than in a header the file format does not have.
            // Somebody will read one of these lines out of context, and when they do it has
            // to say what it is.
            "provenance" to "model_knowledge",
        )

    companion object {
        const val CONTENT_TYPE = "application/x-ndjson"

        fun fileNameFor(run: PoolRun): String = "pool-run-${run.id}.jsonl"
    }
}
