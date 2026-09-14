package com.interviewos.api.interview

import com.interviewos.api.interview.BankFixtures.question
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BankQuestionSelectionTest {
    private val company = BankFixtures.amazon.id

    private val most = question("Tell me about a time you disagreed with your manager.", corroboration = 5)
    private val second = question("Tell me about a time you failed.", corroboration = 4)
    private val third = question("Describe a time you delivered under a tight deadline.", corroboration = 3)
    private val fourth = question("Tell me about a time you simplified something.", corroboration = 2)
    private val fifth = question("Tell me about a time you earned trust.", corroboration = 1)
    private val all = listOf(fifth, third, most, fourth, second)

    @Test
    fun `ranks by corroboration at this company, then by recency`() {
        val older = question("An older report", corroboration = 2, lastReported = LocalDate.of(2024, 5, 1))
        val newer = question("A newer report", corroboration = 2, lastReported = LocalDate.of(2026, 5, 1))

        val ranked = BankQuestionSelection.rank(company, listOf(older, fifth, newer, most))

        assertEquals(listOf(most, newer, older, fifth), ranked)
    }

    @Test
    fun `chooses only among the top few`() {
        val chosen = (0 until 200).map { seed -> choose(Random(seed)) }.toSet()

        assertEquals(setOf(most, second, third), chosen)
    }

    @Test
    fun `different rounds draw different questions, and one round always draws the same`() {
        val drawn = (0 until 50).map { choose(BankQuestionSelection.randomFor(UUID.randomUUID())) }.toSet()
        assertTrue(drawn.size > 1, "fifty rounds all drew the same question")

        val round = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
        assertEquals(
            choose(BankQuestionSelection.randomFor(round)),
            choose(BankQuestionSelection.randomFor(round)),
        )
    }

    @Test
    fun `a question this candidate has been asked before is not chosen while others are left`() {
        val asked = mapOf(most.id to Instant.parse("2026-09-01T10:00:00Z"), second.id to Instant.parse("2026-09-02T10:00:00Z"))

        val chosen = (0 until 100).map { seed -> choose(Random(seed), lastAsked = asked) }.toSet()

        assertEquals(setOf(third, fourth, fifth), chosen)
    }

    @Test
    fun `when every question has been asked, the least recently asked comes back first`() {
        val asked =
            all.mapIndexed { i, q -> q.id to Instant.parse("2026-09-01T10:00:00Z").plusSeconds(i * 3600L) }.toMap()
        // `fifth` is first in `all`, so it was asked longest ago.
        assertEquals(fifth, choose(Random(1), lastAsked = asked))
    }

    @Test
    fun `a question asked in this round never comes back in it`() {
        val asked = all.associate { it.id to Instant.parse("2026-09-01T10:00:00Z") }

        assertEquals(fifth, choose(Random(3), lastAsked = asked, thisRound = all.map { it.id }.toSet() - fifth.id))
        assertNull(choose(Random(3), lastAsked = asked, thisRound = all.map { it.id }.toSet()))
    }

    @Test
    fun `nothing in the bank plans nothing`() {
        assertNull(BankQuestionSelection.choose(company, emptyList(), emptyMap(), emptySet(), Random(0)))
    }

    private fun choose(
        random: Random,
        lastAsked: Map<UUID, Instant> = emptyMap(),
        thisRound: Set<UUID> = emptySet(),
    ) = BankQuestionSelection.choose(company, all, lastAsked, thisRound, random)
}

class PlannedQuestionCheckTest {
    private val behavioural = "Tell me about a time you disagreed with your manager."
    private val design = "Design a URL shortening service like TinyURL that handles 100 million new URLs per month."

    @Test
    fun `a question shaped for speech still counts as asked`() {
        assertTrue(PlannedQuestionCheck.asks("Can you walk me through a time you disagreed with a manager?", behavioural))
        assertTrue(
            PlannedQuestionCheck.asks(
                "Let's design a URL shortener like TinyURL, handling 100 million new URLs a month. Where do you start?",
                design,
            ),
        )
    }

    @Test
    fun `the same topic asked as a different question has drifted`() {
        assertFalse(PlannedQuestionCheck.asks("Describe a conflict with your boss.", behavioural))
        assertFalse(PlannedQuestionCheck.asks("How would you design a paste-bin for a small team?", design))
    }

    @Test
    fun `the threshold sits between the two`() {
        // Two of three content words: under the line. All three: over it.
        val twoOfThree = PlannedQuestionCheck.containment("Tell me about a time with your manager.", behavioural)
        assertTrue(twoOfThree < PlannedQuestionCheck.THRESHOLD, "got $twoOfThree")
        val threeOfThree = PlannedQuestionCheck.containment("A time you disagreed with a manager?", behavioural)
        assertTrue(threeOfThree >= PlannedQuestionCheck.THRESHOLD, "got $threeOfThree")
    }

    @Test
    fun `a faithful delivery keeps the model's wording`() {
        val said = "Let's switch to something else. Walk me through a time you disagreed with your manager."

        val delivery = PlannedQuestionCheck.deliver(said, behavioural)

        assertTrue(delivery.faithful)
        assertEquals(said, delivery.text)
    }

    @Test
    fun `a drifted delivery keeps the lead-in and puts the bank question back`() {
        val said =
            "We have about twenty minutes left, and I want to cover how you work with people. " +
                "Think out loud. Describe a conflict with your boss?"

        val delivery = PlannedQuestionCheck.deliver(said, behavioural)

        assertFalse(delivery.faithful)
        assertEquals(
            "We have about twenty minutes left, and I want to cover how you work with people. Think out loud. $behavioural",
            delivery.text,
        )
    }

    @Test
    fun `a lead-in never carries a second question`() {
        val said = "How did that go in the end? Right. Describe a conflict with your boss."

        assertEquals(behavioural, PlannedQuestionCheck.deliver(said, behavioural).text)
    }

    @Test
    fun `nothing said at all is the bank question on its own`() {
        assertEquals(PlannedQuestionCheck.Delivery(behavioural, faithful = false), PlannedQuestionCheck.deliver(null, behavioural))
    }
}
