package com.interviewos.api.interview

/**
 * How much authority stands behind a question.
 *
 * Mirrors the PRD's knowledge tiers (§03). Only [MODEL_KNOWLEDGE] is reachable today —
 * there is no retrieval corpus — and **the tier is decided by the engine, never by the
 * model.** A model asked to rate its own sourcing will reach for the most impressive
 * label available, and a question labelled `published_source` with nothing behind it is
 * precisely the fabricated specificity that CLAUDE.md calls the most damaging failure
 * this product has.
 */
enum class ProvenanceTier(
    val dbValue: String,
    /** What the candidate is told, verbatim. Written to be unmissable, not reassuring. */
    val disclosure: String,
) {
    MODEL_KNOWLEDGE(
        "model_knowledge",
        "Written for this round from general knowledge of how this kind of employer interviews. " +
            "It is not a report of a question this company has asked, and we are not claiming it is.",
    ),
    PUBLISHED_SOURCE(
        "published_source",
        "Drawn from a published account of this employer's process, cited below.",
    ),
    COMMUNITY_REPORTED(
        "community_reported",
        "Reported by candidates who have sat this loop, and anonymised before it entered the corpus.",
    ),
    ;

    companion object {
        fun fromDbValue(value: String?): ProvenanceTier = entries.firstOrNull { it.dbValue == value } ?: MODEL_KNOWLEDGE
    }
}

/**
 * Why a question was asked, captured at the moment it was composed.
 *
 * Two of these fields are the point of the feature. [probes] is what the question was
 * testing, which turns a list of questions into a map of what was actually assessed.
 * [askedBecause] is why *this* candidate got *this* question — the thing a real
 * interviewer could tell you afterwards and a question bank never can.
 *
 * [sources] is empty on every question today and that is not an oversight. Citations
 * require documents that were actually retrieved. Until there is a corpus, the honest
 * answer is an empty list and a tier that says so.
 */
data class QuestionProvenance(
    val tier: ProvenanceTier,
    /** The pattern this question came from, at archetype level. */
    val basis: String,
    /** What it was testing. */
    val probes: String,
    /** Why this candidate was asked it, referring to what they had already said. */
    val askedBecause: String,
    val sources: List<ProvenanceSource> = emptyList(),
) {
    companion object {
        /**
         * Provenance for a question the model wrote from its own knowledge.
         *
         * **The tier is decided here, not by the model**, and today there is exactly one
         * honest value. The model is asked only to describe the pattern it drew on and
         * why it asked this candidate; it is given no way to claim a source, because a
         * model invited to rate its own sourcing reaches for the most authoritative label
         * available and a question stamped `published_source` with nothing behind it is
         * the fabricated specificity that does this product the most damage.
         *
         * Returns null when the model supplied nothing usable — a missing entry is fine,
         * an empty one that looks like a citation is not.
         */
        fun fromModel(
            basis: String?,
            probes: String?,
            askedBecause: String?,
        ): QuestionProvenance? {
            val cleanBasis = basis?.trim().orEmpty()
            val cleanProbes = probes?.trim().orEmpty()
            val cleanBecause = askedBecause?.trim().orEmpty()
            if (cleanBasis.isEmpty() && cleanProbes.isEmpty() && cleanBecause.isEmpty()) return null

            return QuestionProvenance(
                tier = ProvenanceTier.MODEL_KNOWLEDGE,
                basis = cleanBasis,
                probes = cleanProbes,
                askedBecause = cleanBecause,
                // Citations require documents that were actually retrieved. There is no
                // corpus behind this yet, so the honest list is the empty one.
                sources = emptyList(),
            )
        }

        /**
         * Provenance for a question asked against real documents from the source library.
         *
         * The tier is still the engine's decision, not the model's — but here it can
         * honestly be [ProvenanceTier.PUBLISHED_SOURCE], because [sources] holds documents
         * somebody added, that were actually fetched, and that the candidate can open.
         */
        fun fromSources(
            basis: String?,
            probes: String?,
            askedBecause: String?,
            sources: List<ProvenanceSource>,
        ): QuestionProvenance? {
            if (sources.isEmpty()) return fromModel(basis, probes, askedBecause)
            val base = fromModel(basis, probes, askedBecause) ?: return null
            return base.copy(tier = ProvenanceTier.PUBLISHED_SOURCE, sources = sources)
        }
    }
}

/** A real, retrievable document. Never written from a model's recollection. */
data class ProvenanceSource(
    val title: String,
    val publisher: String?,
    val url: String?,
    val year: Int?,
)
