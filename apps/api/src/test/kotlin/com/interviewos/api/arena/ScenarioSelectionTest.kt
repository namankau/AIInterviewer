package com.interviewos.api.arena

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Random

class ScenarioSelectionTest {
    private val now = Instant.parse("2026-10-16T00:00:00Z")

    private fun candidate(
        id: String,
        course: String = "dsa",
        tier: String = "foundations",
        concepts: List<String> = listOf("trie"),
        status: String = "live",
    ) = ScenarioCandidate(id, course, tier, status, concepts)

    @Test
    fun `selection never crosses courses or serves drafts or finished scenarios`() {
        val selected =
            ScenarioSelection.pick(
                "dsa",
                listOf(candidate("java", "java"), candidate("draft", status = "draft"), candidate("done"), candidate("new")),
                setOf("done"),
                null,
                emptyMap(),
                now,
                Random(1),
            )
        assertEquals("new", selected?.id)
    }

    @Test
    fun `active scenario resumes before weighted selection`() {
        val selected =
            ScenarioSelection.pick(
                "dsa",
                listOf(candidate("active"), candidate("other")),
                emptySet(),
                "active",
                emptyMap(),
                now,
                Random(1),
            )
        assertEquals("active", selected?.id)
    }

    @Test
    fun `tier unlock requires completed scenarios`() {
        val advanced = candidate("advanced", tier = "advanced")
        assertNull(ScenarioSelection.pick("dsa", listOf(advanced), emptySet(), null, emptyMap(), now, Random(1)))
        assertEquals(1, ScenarioSelection.unlockedTier(1))
        assertEquals(2, ScenarioSelection.unlockedTier(3))
        assertEquals(3, ScenarioSelection.unlockedTier(5))
    }

    @Test
    fun `lower mastery carries greater selection weight`() {
        val candidates = listOf(candidate("weak", concepts = listOf("weak")), candidate("strong", concepts = listOf("strong")))
        val mastery = mapOf("weak" to ConceptScore(0.0, now), "strong" to ConceptScore(1.0, now))
        val random = Random(1)
        val selected =
            (0..999).map {
                ScenarioSelection.pick("dsa", candidates, emptySet(), null, mastery, now, random)?.id
            }
        assert(selected.count { it == "weak" } > selected.count { it == "strong" })
    }

    @Test
    fun `mastery moves with answers and decays toward neutral`() {
        val old = ConceptScore(0.9, now.minusSeconds(100L * 86400))
        val decayed = ScenarioSelection.decayedScore(old, now)
        assert(decayed < 0.9 && decayed > 0.5)
        assert(ScenarioSelection.afterAnswer(old, true, now) > decayed)
        assert(ScenarioSelection.afterAnswer(old, false, now) < decayed)
    }
}
