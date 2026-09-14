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
            evidence.isNotEmpty() && normalisedDocument.contains(evidence)
        }
    }

    /** Runs of whitespace collapsed to one space, trimmed. Case and punctuation are left alone. */
    private fun normalise(text: String): String = text.replace(WHITESPACE, " ").trim()

    private val WHITESPACE = Regex("\\s+")
}
