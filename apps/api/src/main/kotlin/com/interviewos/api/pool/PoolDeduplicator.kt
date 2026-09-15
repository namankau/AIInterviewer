package com.interviewos.api.pool

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.GeneratedQuestion
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.bank.QuestionFingerprint
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Stops the pool filling up with the same question sixty times.
 *
 * A generation job asks one model the same thing once per company, so it produces near
 * duplicates by construction: "Tell me about a time you disagreed with your manager" and
 * "Describe a disagreement you had with a manager and how you handled it" are the same
 * question, arriving from different cells, hours apart. Fingerprints — the bank's exact
 * normalisation, reused rather than reinvented — catch punctuation and casing and nothing
 * else, so they are the free first pass and not the whole answer.
 *
 * Three comparisons, in cost order:
 *
 * 1. **Fingerprint**, against everything already held for this company and round type,
 *    against the sourced bank, and within the batch itself. Free, exact, no call.
 * 2. **Embedding**, against the pool rows already stored for this company and round type.
 *    One model call for the whole batch.
 * 3. **Embedding, against the sourced bank's own questions for this company and round**,
 *    embedded in the same call rather than a second one.
 *
 * **When a pool question matches a sourced one, the pool question is dropped.** Never the
 * other way round, and there is no path in this class that could write to the bank even if
 * somebody wanted it to. A sourced question is something a fetched document says a real
 * employer asked; a pool question is a model's recollection of the same thing. Where they
 * agree, the evidence is worth more than the recollection, and keeping both would put the
 * same question in a round twice with two different provenance labels.
 */
@Component
class PoolDeduplicator(
    private val ai: InterviewAi,
    private val properties: PoolProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Everything a new batch must not duplicate.
     *
     * @param fingerprints normalised text of every pool question already held for this
     *   company and round, and of the sourced bank questions in [bankTexts]
     * @param embeddings vectors of the pool questions already held for this company and
     *   round. Rows generated before embeddings were available simply are not here, and
     *   are covered by their fingerprints alone.
     * @param bankTexts sourced questions for this company and round, to be compared
     *   semantically as well as exactly. Capped by the repository: this is a comparison
     *   set, not the bank.
     */
    data class Existing(
        val fingerprints: Set<String>,
        val embeddings: List<FloatArray>,
        val bankTexts: List<String> = emptyList(),
        /**
         * Wording of the pool questions already held here. Not used for comparison — the
         * fingerprints and vectors do that — but handed to the generator so it is asked
         * not to write them again. Prevention is cheaper than the call that produces a
         * duplicate and then throws it away.
         */
        val poolTexts: List<String> = emptyList(),
    )

    /** A question that survived, with the vector it was compared on, ready to be stored. */
    data class Kept(
        val question: GeneratedQuestion,
        val embedding: FloatArray?,
    )

    data class Outcome(
        val kept: List<Kept>,
        val dropped: Int,
        /** Whether the semantic pass actually ran. False means fingerprints only. */
        val comparedSemantically: Boolean,
    )

    /**
     * @param embeddingsSupported whether `pool_questions.embedding` exists — pgvector may
     *   not have been creatable when the migration ran. False degrades this to the exact
     *   pass, which is worse but correct, rather than failing the run.
     */
    fun dedupe(
        candidates: List<GeneratedQuestion>,
        existing: Existing,
        embeddingsSupported: Boolean,
    ): Outcome {
        var dropped = 0
        val seen = existing.fingerprints.toMutableSet()
        val exact = mutableListOf<GeneratedQuestion>()

        for (candidate in candidates) {
            val sanitised = PoolQuestionSanitiser.sanitise(candidate)
            if (sanitised == null) {
                log.info("Dropping a generated question that could not be made into a valid row")
                dropped++
                continue
            }
            val fingerprint = QuestionFingerprint.of(sanitised.text)
            if (!seen.add(fingerprint)) {
                dropped++
                continue
            }
            exact += sanitised
        }

        if (exact.isEmpty()) return Outcome(emptyList(), dropped, comparedSemantically = false)
        if (!embeddingsSupported) {
            return Outcome(exact.map { Kept(it, null) }, dropped, comparedSemantically = false)
        }

        // One call for the batch and the bank comparison set together. Two calls would be
        // two rate-limit permits and two ledger rows for one question.
        val texts = exact.map { it.text } + existing.bankTexts
        val vectors =
            try {
                ai.embed(texts, properties.embeddingModel, properties.embeddingDimensions).value.vectors
            } catch (e: AiUnavailableException) {
                // Worth a cell's questions going in on fingerprints alone. Failing the cell
                // here would throw away generation that has already been paid for, to avoid
                // a duplicate that a human review of the export would catch anyway.
                log.warn("Could not embed a batch for deduplication; falling back to fingerprints only", e)
                return Outcome(exact.map { Kept(it, null) }, dropped, comparedSemantically = false)
            }

        val candidateVectors = vectors.take(exact.size)
        val bankVectors = vectors.drop(exact.size)
        val kept = mutableListOf<Kept>()

        for ((index, question) in exact.withIndex()) {
            val vector = candidateVectors.getOrNull(index)
            if (vector == null) {
                kept += Kept(question, null)
                continue
            }
            val duplicateOfStored = existing.embeddings.any { similar(vector, it) }
            val duplicateOfSourced = bankVectors.any { similar(vector, it) }
            val duplicateOfBatch = kept.any { it.embedding != null && similar(vector, it.embedding) }
            if (duplicateOfStored || duplicateOfSourced || duplicateOfBatch) {
                if (duplicateOfSourced) {
                    log.info("Dropping a pool question the sourced bank already holds for this company and round")
                }
                dropped++
                continue
            }
            kept += Kept(question, Vectors.normalise(vector))
        }

        return Outcome(kept, dropped, comparedSemantically = true)
    }

    private fun similar(
        a: FloatArray,
        b: FloatArray,
    ): Boolean = a.size == b.size && Vectors.cosine(a, b) >= properties.duplicateSimilarity
}
