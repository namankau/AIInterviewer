package com.interviewos.api.loopbrief

import com.interviewos.api.ai.ExtractedProcessStage
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ProcessStageVerifierTest {
    private val document =
        """
        Our interview process for Backend Engineers starts with a 45-minute
        online assessment covering data structures and algorithms.

        Candidates who pass move to a virtual onsite: two coding interviews, one
        system design session, and a behavioural round we call the "Bar Raiser"
        interview, which any team member trained as a bar raiser can run.
        """.trimIndent()

    @Test
    fun `keeps a stage whose evidence is a verbatim quote`() {
        val stage = stage(evidence = "a 45-minute\n        online assessment covering data structures and algorithms.")

        val kept = ProcessStageVerifier.verify(document, listOf(stage))

        assertThat(kept).containsExactly(stage)
    }

    @Test
    fun `keeps a stage whose evidence only differs by whitespace`() {
        val stage = stage(evidence = "a   45-minute online   assessment covering data structures and algorithms.")

        val kept = ProcessStageVerifier.verify(document, listOf(stage))

        assertThat(kept).containsExactly(stage)
    }

    @Test
    fun `drops a stage whose evidence does not occur in the document`() {
        val stage = stage(evidence = "a two-week take-home project graded by a panel of five")

        val kept = ProcessStageVerifier.verify(document, listOf(stage))

        assertThat(kept).isEmpty()
    }

    @Test
    fun `drops a stage whose evidence is blank`() {
        val stage = stage(evidence = "   ")

        val kept = ProcessStageVerifier.verify(document, listOf(stage))

        assertThat(kept).isEmpty()
    }

    @Test
    fun `drops a paraphrase even when every word individually appears in the document`() {
        val stage = stage(evidence = "assessment online, forty-five minutes, data structures")

        val kept = ProcessStageVerifier.verify(document, listOf(stage))

        assertThat(kept).isEmpty()
    }

    @Test
    fun `keeps the stages that pass and drops the ones that fail, independently`() {
        val real = stage(evidence = "the \"Bar Raiser\" interview, which any team member trained as a bar raiser can run.")
        val invented = stage(evidence = "a final round with the CEO over dinner")

        val kept = ProcessStageVerifier.verify(document, listOf(real, invented))

        assertThat(kept).containsExactly(real)
    }

    private fun stage(evidence: String) =
        ExtractedProcessStage(
            companies = listOf("Amazon"),
            stageName = "Online assessment",
            evidence = evidence,
        )
}
