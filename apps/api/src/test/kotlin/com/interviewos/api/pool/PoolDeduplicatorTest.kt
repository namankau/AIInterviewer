package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.TextEmbeddings
import com.interviewos.api.bank.QuestionFingerprint
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Deduplication, on fixed vectors. **Nothing here embeds anything for real** — the
 * vectors are written out by hand so the arithmetic is the thing under test and no test
 * depends on a live embedding model (CLAUDE.md rule 7).
 */
class PoolDeduplicatorTest {
    private val properties = PoolProperties(duplicateSimilarity = 0.90, embeddingDimensions = 3)

    /** Unit vectors chosen so the similarities are obvious by inspection. */
    private val north = floatArrayOf(1f, 0f, 0f)
    private val nearlyNorth = floatArrayOf(0.98f, 0.199f, 0f)
    private val east = floatArrayOf(0f, 1f, 0f)
    private val up = floatArrayOf(0f, 0f, 1f)

    private fun question(
        text: String,
        followUps: List<String> = listOf("And then?", "What would you change?"),
    ) = GeneratedQuestion(text = text, followUps = followUps, strongAnswerCovers = listOf("something concrete"))

    private fun ai(vectors: List<FloatArray>) =
        object : StubPoolAi() {
            var calls = 0

            override fun embed(
                texts: List<String>,
                model: String,
                dimensions: Int,
            ): AiResult<TextEmbeddings> {
                calls++
                return AiResult(TextEmbeddings(vectors.take(texts.size), model), AiUsage.none(model))
            }
        }

    @Test
    fun `an exact repeat of a stored question is dropped without an embedding call`() {
        val stored = "Tell me about a time you disagreed with your manager."
        val embedder = ai(emptyList())
        val deduplicator = PoolDeduplicator(embedder, properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("Tell me about a time you disagreed with your manager!")),
                existing = PoolDeduplicator.Existing(setOf(QuestionFingerprint.of(stored)), emptyList()),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept).isEmpty()
        assertThat(outcome.dropped).isEqualTo(1)
        // The fingerprint pass is free and runs first, so nothing was spent finding this.
        assertThat(embedder.calls).isZero()
    }

    @Test
    fun `a rephrasing of a stored question is dropped on similarity`() {
        val deduplicator = PoolDeduplicator(ai(listOf(nearlyNorth)), properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("Describe a disagreement you had with a manager.")),
                existing = PoolDeduplicator.Existing(emptySet(), listOf(north)),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept).isEmpty()
        assertThat(outcome.dropped).isEqualTo(1)
        assertThat(outcome.comparedSemantically).isTrue()
    }

    @Test
    fun `a genuinely different question is kept, normalised`() {
        val deduplicator = PoolDeduplicator(ai(listOf(floatArrayOf(0f, 3f, 0f))), properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("Why this team rather than another?")),
                existing = PoolDeduplicator.Existing(emptySet(), listOf(north)),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept).hasSize(1)
        assertThat(outcome.dropped).isZero()
        // Stored unit length, so cosine and inner product agree on the column.
        assertThat(outcome.kept.single().embedding).containsExactly(0f, 1f, 0f)
    }

    @Test
    fun `when a pool question reproduces a sourced one, the pool question loses`() {
        // The bank's question is embedded in the same call, after the candidates, so the
        // comparison costs nothing extra. A sourced question is backed by a document; the
        // pool's is a recollection of the same thing, and the evidence wins.
        val deduplicator = PoolDeduplicator(ai(listOf(nearlyNorth, north)), properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("Walk me through a production incident you owned.")),
                existing =
                    PoolDeduplicator.Existing(
                        fingerprints = emptySet(),
                        embeddings = emptyList(),
                        bankTexts = listOf("Describe an outage you were responsible for."),
                    ),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept).isEmpty()
        assertThat(outcome.dropped).isEqualTo(1)
    }

    @Test
    fun `two near-identical questions in the same batch collapse to one`() {
        val deduplicator = PoolDeduplicator(ai(listOf(north, nearlyNorth, east)), properties)

        val outcome =
            deduplicator.dedupe(
                candidates =
                    listOf(
                        question("What draws you to this kind of company?"),
                        question("What attracts you to an employer like this one?"),
                        question("Where do you want to be in three years?"),
                    ),
                existing = PoolDeduplicator.Existing(emptySet(), emptyList()),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept.map { it.question.text })
            .containsExactly("What draws you to this kind of company?", "Where do you want to be in three years?")
        assertThat(outcome.dropped).isEqualTo(1)
    }

    @Test
    fun `without the vector column it falls back to fingerprints rather than failing`() {
        val embedder = ai(emptyList())
        val deduplicator = PoolDeduplicator(embedder, properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("Why do you want to leave your current role?")),
                existing = PoolDeduplicator.Existing(emptySet(), emptyList()),
                embeddingsSupported = false,
            )

        assertThat(outcome.kept).hasSize(1)
        assertThat(outcome.kept.single().embedding).isNull()
        assertThat(outcome.comparedSemantically).isFalse()
        assertThat(embedder.calls).isZero()
    }

    @Test
    fun `an embedding failure degrades the pass rather than throwing away paid-for generation`() {
        val failing =
            object : StubPoolAi() {
                override fun embed(
                    texts: List<String>,
                    model: String,
                    dimensions: Int,
                ): AiResult<TextEmbeddings> = throw AiUnavailableException("embeddings are down")
            }
        val deduplicator = PoolDeduplicator(failing, properties)

        val outcome =
            deduplicator.dedupe(
                candidates = listOf(question("What would your last manager say about you?")),
                existing = PoolDeduplicator.Existing(emptySet(), emptyList()),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept).hasSize(1)
        assertThat(outcome.comparedSemantically).isFalse()
    }

    @Test
    fun `a question the database would reject is dropped here instead of failing the cell`() {
        val deduplicator = PoolDeduplicator(ai(listOf(up)), properties)

        val outcome =
            deduplicator.dedupe(
                candidates =
                    listOf(
                        // One follow-up: the database requires two, and nothing here
                        // invents the missing one.
                        question("Why us?", followUps = listOf("Anything else?")),
                        question("What are you looking for in your next role?"),
                    ),
                existing = PoolDeduplicator.Existing(emptySet(), emptyList()),
                embeddingsSupported = true,
            )

        assertThat(outcome.kept.map { it.question.text })
            .containsExactly("What are you looking for in your next role?")
        assertThat(outcome.dropped).isEqualTo(1)
    }
}
