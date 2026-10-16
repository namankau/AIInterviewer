package com.interviewos.api.arena

import java.time.Duration
import java.time.Instant
import java.util.Random

data class ScenarioCandidate(
    val id: String,
    val courseId: String,
    val tier: String,
    val status: String,
    val conceptIds: List<String>,
)

data class ConceptScore(
    val score: Double,
    val lastSeenAt: Instant,
)

/** The only scenario selector: course scope, unfinished resume, tier gate, then weakness weight. */
object ScenarioSelection {
    fun unlockedTier(completed: Int): Int =
        when {
            completed >= 5 -> 3
            completed >= 3 -> 2
            completed >= 1 -> 1
            else -> 0
        }

    fun decayedScore(
        mastery: ConceptScore?,
        now: Instant,
    ): Double {
        if (mastery == null) return 0.5
        val days = Duration.between(mastery.lastSeenAt, now).toDays().coerceAtLeast(0)
        val retained = Math.pow(0.98, days.toDouble())
        return (0.5 + (mastery.score - 0.5) * retained).coerceIn(0.0, 1.0)
    }

    fun afterAnswer(
        mastery: ConceptScore?,
        correct: Boolean,
        now: Instant,
    ): Double = (decayedScore(mastery, now) + if (correct) 0.12 else -0.16).coerceIn(0.0, 1.0)

    fun pick(
        courseId: String,
        candidates: List<ScenarioCandidate>,
        completedIds: Set<String>,
        activeId: String?,
        mastery: Map<String, ConceptScore>,
        now: Instant,
        random: Random,
    ): ScenarioCandidate? {
        val eligible = candidates.filter { it.courseId == courseId && it.status == "live" }
        eligible.firstOrNull { it.id == activeId }?.let { return it }
        val tiers = listOf("foundations", "intermediate", "advanced", "expert")
        val available = eligible.filter { it.id !in completedIds && tiers.indexOf(it.tier) in 0..unlockedTier(completedIds.size) }
        if (available.isEmpty()) return null
        val weights =
            available.map { candidate ->
                1.0 + candidate.conceptIds.sumOf { 1.0 - decayedScore(mastery[it], now) }
            }
        val draw = random.nextDouble() * weights.sum()
        var cumulative = 0.0
        for (index in available.indices) {
            cumulative += weights[index]
            if (draw < cumulative) return available[index]
        }
        return available.last()
    }
}
