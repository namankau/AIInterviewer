package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The rule that makes it safe to let a model describe a real employer: a sentence the
 * search grounding does not tie to a page never leaves the boundary.
 *
 * Every response here is the shape Gemini's `generateContent` returns with the
 * `googleSearch` tool on — `content.parts` for the answer, `groundingMetadata` for what
 * supports it. No test calls a live model.
 */
class GroundedAnswerTest {
    private val mapper = ObjectMapper()

    @Test
    fun `a supported sentence is kept with the page behind it`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "Sagitec starts with an online aptitude test.",
                    chunks = listOf(web("https://example.org/sagitec-hiring", "example.org")),
                    supports = listOf(support("Sagitec starts with an online aptitude test.", 0)),
                ),
            )

        assertEquals(listOf(GroundedClaim("Sagitec starts with an online aptitude test.", listOf(0))), loop.claims)
        assertEquals(listOf(GroundedWebSource("example.org", "https://example.org/sagitec-hiring")), loop.sources)
    }

    /** The case this whole class exists for: fluent detail the model added from memory. */
    @Test
    fun `a sentence no page supports is dropped`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "There is an aptitude test. The final round is always with the CEO.",
                    chunks = listOf(web("https://example.org/a", "example.org")),
                    supports = listOf(support("There is an aptitude test.", 0, start = 0)),
                ),
            )

        assertEquals(listOf("There is an aptitude test."), loop.claims.map { it.text })
    }

    @Test
    fun `nothing is kept when the grounding supports nothing`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "They run three technical rounds.",
                    chunks = listOf(web("https://example.org/a", "example.org")),
                    supports = emptyList(),
                ),
            )

        assertTrue(loop.isEmpty)
        assertTrue(loop.sources.isEmpty(), "a page nothing cites is not shown as a source")
    }

    @Test
    fun `the model saying it found nothing is an empty answer, not a claim`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = GroundedAnswer.NOTHING_FOUND,
                    chunks = listOf(web("https://example.org/a", "example.org")),
                    supports = listOf(support(GroundedAnswer.NOTHING_FOUND, 0)),
                ),
            )

        assertTrue(loop.isEmpty)
    }

    @Test
    fun `a chunk with no web address is not a citation`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "Interviews run over video.",
                    chunks = listOf(web("javascript:alert(1)", "bad"), web("", "")),
                    supports = listOf(support("Interviews run over video.", 0, 1)),
                ),
            )

        assertTrue(loop.isEmpty)
    }

    @Test
    fun `an index past the chunk list is ignored rather than trusted`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "Interviews run over video.",
                    chunks = listOf(web("https://example.org/a", "example.org")),
                    supports = listOf(support("Interviews run over video.", 0, 7)),
                ),
            )

        assertEquals(listOf(0), loop.claims.single().sourceIndexes)
    }

    @Test
    fun `the same page cited twice is one source, numbered in reading order`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "First a test. Then a panel.",
                    chunks =
                        listOf(
                            web("https://b.example/panel", "b.example"),
                            web("https://a.example/test", "a.example"),
                            web("https://a.example/test", "a.example"),
                        ),
                    supports =
                        listOf(
                            support("Then a panel.", 0, 2, start = 14),
                            support("First a test.", 1, start = 0),
                        ),
                ),
            )

        assertEquals(listOf("First a test.", "Then a panel."), loop.claims.map { it.text })
        assertEquals(listOf("https://a.example/test", "https://b.example/panel"), loop.sources.map { it.url })
        assertEquals(listOf(listOf(0), listOf(0, 1)), loop.claims.map { it.sourceIndexes })
    }

    @Test
    fun `a page with no title is shown by its host`() {
        val loop =
            GroundedAnswer.read(
                candidate(
                    text = "There is a group discussion.",
                    chunks = listOf(web("https://careers.example.com/process", "")),
                    supports = listOf(support("There is a group discussion.", 0)),
                ),
            )

        assertEquals("careers.example.com", loop.sources.single().title)
    }

    @Test
    fun `sources are capped and a claim left with none is dropped`() {
        val pages = (0..GroundedAnswer.MAX_SOURCES).map { web("https://s$it.example/", "s$it") }
        val supports = pages.indices.map { support("Claim $it.", it, start = it * 10) }

        val loop = GroundedAnswer.read(candidate("ignored", pages, supports))

        assertEquals(GroundedAnswer.MAX_SOURCES, loop.sources.size)
        assertEquals(GroundedAnswer.MAX_SOURCES, loop.claims.size)
        assertTrue(loop.claims.none { it.text == "Claim ${GroundedAnswer.MAX_SOURCES}." })
    }

    @Test
    fun `an answer with no grounding metadata at all is empty`() {
        val node = mapper.readTree("""{"content":{"parts":[{"text":"They hire through campus drives."}]}}""")

        assertTrue(GroundedAnswer.read(node).isEmpty)
    }

    private fun candidate(
        text: String,
        chunks: List<Map<String, Any>>,
        supports: List<Map<String, Any>>,
    ): JsonNode =
        mapper.valueToTree(
            mapOf(
                "content" to mapOf("parts" to listOf(mapOf("text" to text))),
                "groundingMetadata" to
                    mapOf(
                        "webSearchQueries" to listOf("employer interview process"),
                        "groundingChunks" to chunks,
                        "groundingSupports" to supports,
                    ),
            ),
        )

    private fun web(
        uri: String,
        title: String,
    ): Map<String, Any> = mapOf("web" to mapOf("uri" to uri, "title" to title))

    private fun support(
        text: String,
        vararg chunks: Int,
        start: Int = 0,
    ): Map<String, Any> =
        mapOf(
            "segment" to mapOf("startIndex" to start, "endIndex" to start + text.length, "text" to text),
            "groundingChunkIndices" to chunks.toList(),
        )
}
