package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.ObjectMapper

/**
 * What the interviewer is told about a planned question (task 042). A pool question is
 * handed to the model the same way a bank question is, and must never reach it described as
 * reported — a model told a question is "reported for Amazon" will say so to the candidate.
 * No live call: this fills the real template and reads it.
 */
class PlannedQuestionPromptTest {
    private val library = PromptLibrary(ObjectMapper())

    @Test
    fun `a pool question is described as general knowledge that no source reports`() {
        val prompt = assess(PlannedQuestion("Tell me about a time you took ownership.", "Amazon", askNow = true, reported = false))

        assertThat(prompt).doesNotContain("{{")
        assertThat(prompt).contains("\"Tell me about a time you took ownership.\" (written ahead of time from general knowledge")
        assertThat(prompt).contains("no source we hold reports Amazon asking it")
        assertThat(prompt).doesNotContain("(reported for Amazon by sources we hold)")
    }

    @Test
    fun `a bank question is still described as reported`() {
        val prompt = assess(PlannedQuestion("Tell me about a time you disagreed with your manager.", "Amazon", askNow = false))

        assertThat(prompt).doesNotContain("{{")
        assertThat(prompt).contains("\"Tell me about a time you disagreed with your manager.\" (reported for Amazon by sources we hold)")
    }

    private fun assess(planned: PlannedQuestion): String =
        library.assessAnswer(
            brief =
                InterviewBrief(
                    company = "Amazon",
                    archetype = "Global product company",
                    role = "SDE 2",
                    roundType = "Behavioural and competency.",
                    roundCovers = "- Ownership",
                    language = "english",
                    candidateFunction = null,
                    candidateLevel = null,
                    targetLevel = null,
                    grounding = "General patterns.",
                    plannedQuestion = planned,
                ),
            round =
                RoundContext(
                    phase = "main round",
                    minutesElapsed = 10,
                    minutesRemaining = 30,
                    durationMinutes = 40,
                    warmupInstruction = null,
                    briefTheCandidate = planned.askNow,
                    mustConclude = false,
                ),
            priorTurns = emptyList(),
            currentQuestion = "What are you working on?",
        )
}
