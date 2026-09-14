package com.interviewos.api.loopbrief

import com.interviewos.api.ai.ExtractedProcessStage

/**
 * The one thing that stops extraction inventing an employer's process.
 *
 * Every process stage the model reports must carry a verbatim quote from the document
 * it was read from. This checks that the quote is really there, whitespace aside, and
 * drops any stage whose evidence is not — a paraphrase, a reconstruction from memory, or
 * an outright invention are all indistinguishable to a candidate reading the page, so
 * the engine checks rather than trusts.
 *
 * **A minimum length on the evidence itself, not just a substring match.** Live testing
 * against a real page that happened to 404 (its own nav still returned real text) showed
 * the model quoting the stage name back as its own evidence — "Backend System Design
 * Interviews" is trivially "verbatim" of a page that merely lists that string in a menu,
 * without saying anything about a stage that actually runs. [MIN_EVIDENCE_LENGTH]
 * requires evidence long enough to be a sentence about the stage, not a repeated label.
 */
object ProcessStageVerifier {
    /** [stages] that survive the evidence check against [documentText]. */
    fun verify(
        documentText: String,
        stages: List<ExtractedProcessStage>,
    ): List<ExtractedProcessStage> {
        val normalisedDocument = normalise(documentText)
        return stages.filter { stage ->
            val evidence = normalise(stage.evidence)
            evidence.length >= MIN_EVIDENCE_LENGTH && normalisedDocument.contains(evidence)
        }
    }

    /** Runs of whitespace collapsed to one space, trimmed. Case and punctuation are left alone. */
    private fun normalise(text: String): String = text.replace(WHITESPACE, " ").trim()

    private val WHITESPACE = Regex("\\s+")

    /** Shorter than this and a label can pass as "evidence" of itself. */
    private const val MIN_EVIDENCE_LENGTH = 25
}
