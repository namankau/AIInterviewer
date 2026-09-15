package com.interviewos.api.pool

import com.interviewos.api.ai.GeneratedQuestion
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class PoolQuestionSanitiserTest {
    private fun question(
        text: String = "Why do you want to work somewhere like this?",
        followUps: List<String> = listOf("What would change your mind?", "What would you miss?"),
        covers: List<String> = listOf("a specific reason", "evidence they looked into it"),
    ) = GeneratedQuestion(text = text, followUps = followUps, strongAnswerCovers = covers)

    @Test
    fun `it collapses whitespace in the wording`() {
        val sanitised = PoolQuestionSanitiser.sanitise(question(text = "  Why   this team?\n "))

        assertThat(sanitised?.text).isEqualTo("Why this team?")
    }

    @Test
    fun `a fourth follow-up is dropped rather than the question`() {
        val sanitised =
            PoolQuestionSanitiser.sanitise(
                question(followUps = listOf("One?", "Two?", "Three?", "Four?")),
            )

        assertThat(sanitised?.followUps).containsExactly("One?", "Two?", "Three?")
    }

    @Test
    fun `a repeated follow-up does not count towards the minimum`() {
        val sanitised =
            PoolQuestionSanitiser.sanitise(question(followUps = listOf("Why?", "Why?", " Why? ")))

        assertThat(sanitised).isNull()
    }

    @Test
    fun `a question with one follow-up is refused rather than padded`() {
        // Padding it would put text in front of a candidate that nothing wrote on purpose.
        assertThat(PoolQuestionSanitiser.sanitise(question(followUps = listOf("And?")))).isNull()
    }

    @Test
    fun `text that normalises to nothing is refused`() {
        // The database's fingerprint is generated from the text and may not be empty, so a
        // row like this would fail the whole batch on insert.
        assertThat(PoolQuestionSanitiser.sanitise(question(text = "???"))).isNull()
        assertThat(PoolQuestionSanitiser.sanitise(question(text = "   "))).isNull()
    }

    @Test
    fun `an empty strong-answer list is allowed`() {
        val sanitised = PoolQuestionSanitiser.sanitise(question(covers = emptyList()))

        assertThat(sanitised).isNotNull
        assertThat(sanitised?.strongAnswerCovers).isEmpty()
    }
}
