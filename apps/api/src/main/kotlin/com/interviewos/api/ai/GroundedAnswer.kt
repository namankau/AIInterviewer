package com.interviewos.api.ai

import tools.jackson.databind.JsonNode
import java.net.URI

/**
 * Turns a search-grounded Gemini answer into claims that each carry their sources —
 * and drops every sentence that does not.
 *
 * The model's text is never trusted as a whole. Gemini reports, alongside the answer,
 * which spans of it a search result supports (`groundingSupports`) and which pages those
 * results were (`groundingChunks`). Only the supported spans are kept, so a sentence the
 * model added from memory — the fluent, plausible, invented detail about a real
 * employer — is discarded here, before any caller can show it.
 *
 * Kept separate from [GeminiInterviewAi] so the rule can be tested against a recorded
 * response shape without a live call.
 */
internal object GroundedAnswer {
    /** What the prompt asks the model to say when the search found nothing usable. */
    const val NOTHING_FOUND = "NO_PUBLIC_SOURCES"

    /** Enough to corroborate a short summary; more is a reading list nobody opens. */
    const val MAX_SOURCES = 6

    fun read(candidate: JsonNode): GroundedEmployerLoop {
        val text =
            candidate
                .path("content")
                .path("parts")
                .values()
                .joinToString("") { textOf(it.path("text")) }
        if (text.isBlank() || text.contains(NOTHING_FOUND)) return GroundedEmployerLoop()

        val metadata = candidate.path("groundingMetadata")
        val pages = metadata.path("groundingChunks").values().map { pageOf(it.path("web")) }

        // Supported spans, merged when the model's grounding names the same span twice,
        // in the order they appear in the answer.
        val supported = linkedMapOf<String, MutableSet<Int>>()
        metadata
            .path("groundingSupports")
            .values()
            .sortedBy { it.path("segment").path("startIndex").asInt(0) }
            .forEach { support ->
                val claim = textOf(support.path("segment").path("text")).trim()
                val chunks =
                    support
                        .path("groundingChunkIndices")
                        .values()
                        .map { it.asInt(-1) }
                        .filter { pages.getOrNull(it) != null }
                if (claim.isNotEmpty() && !claim.contains(NOTHING_FOUND) && chunks.isNotEmpty()) {
                    supported.getOrPut(claim) { linkedSetOf() }.addAll(chunks)
                }
            }

        // Renumber the pages in the order a reader first meets them, one entry per URL,
        // and drop any claim whose only support fell past the cap.
        val sources = mutableListOf<GroundedWebSource>()
        val claims =
            supported.mapNotNull { (claim, chunks) ->
                val indexes =
                    chunks
                        .mapNotNull { chunk ->
                            val page = pages[chunk]!!
                            val existing = sources.indexOfFirst { it.url == page.url }
                            when {
                                existing >= 0 -> existing
                                sources.size < MAX_SOURCES -> sources.add(page).let { sources.lastIndex }
                                else -> null
                            }
                        }.distinct()
                        .sorted()
                indexes.takeIf { it.isNotEmpty() }?.let { GroundedClaim(claim, it) }
            }

        return GroundedEmployerLoop(claims = claims, sources = sources)
    }

    /** A page a candidate can open, or null: a chunk with no web address is not a citation. */
    private fun pageOf(web: JsonNode): GroundedWebSource? {
        val url = textOf(web.path("uri")).trim()
        val host =
            runCatching { URI(url) }
                .getOrNull()
                ?.takeIf { it.scheme == "https" || it.scheme == "http" }
                ?.host
                ?.takeIf { it.isNotBlank() }
                ?: return null
        val title = textOf(web.path("title")).trim().ifEmpty { host }
        return GroundedWebSource(title = title, url = url)
    }

    private fun textOf(node: JsonNode): String = if (node.isMissingNode || node.isNull) "" else node.asString() ?: ""
}
