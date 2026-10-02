package com.interviewos.api.loopbrief

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.GroundedEmployerLoop
import com.interviewos.api.ai.InterviewAi
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * What public pages say about an employer we hold no sourced account of (task 065).
 *
 * Before this, a company outside the library got only the archetype pattern — honest,
 * but generic for exactly the employers this product promises to cover beyond the
 * usual product companies. This asks a search-grounded model instead, and keeps only
 * the claims a page supports (`GroundedAnswer`). When nothing citable turns up, or the
 * search is unavailable, it answers null and the brief falls back to the archetype
 * pattern, which says so.
 *
 * **Held in memory, not in a table.** Two reasons. Every grounded search is billed per
 * query on top of its tokens, so the same company must not be searched for every
 * candidate who types it — but the links Gemini returns are redirect URLs that expire,
 * so an answer kept for weeks would turn into dead citations. A bounded, expiring cache
 * is the honest middle: a burst of candidates for one employer costs one search, and no
 * citation outlives its link by much. Misses are cached too, so an employer with no
 * public trace is not re-searched on every visit.
 */
@Component
class PublicLoopResearch internal constructor(
    private val interviewAi: InterviewAi,
    private val properties: PublicLoopResearchProperties,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        interviewAi: InterviewAi,
        properties: PublicLoopResearchProperties,
    ) : this(interviewAi, properties, Clock.systemUTC())

    private val log = LoggerFactory.getLogger(javaClass)
    private val answers = ConcurrentHashMap<Key, Answer>()

    fun patternFor(
        companyName: String,
        role: String?,
        level: String?,
    ): GroundedEmployerLoop? {
        if (!properties.enabled) return null
        val company = companyName.trim().replace(WHITESPACE, " ")
        // A name this long is a pasted job description or a prompt, not an employer.
        if (company.isEmpty() || company.length > MAX_COMPANY_LENGTH) return null

        val key = Key(company.lowercase(), LoopBucket.roleFamily(role), LoopBucket.levelBand(level))
        val now = clock.instant()
        answers[key]?.takeIf { it.expiresAt.isAfter(now) }?.let { return it.loop }

        val loop =
            try {
                interviewAi.researchEmployerLoop(company, key.roleFamily, key.levelBand).value
            } catch (e: AiUnavailableException) {
                // Not cached: an outage is not evidence that there is nothing to find.
                log.warn("Could not research public sources for {} / {} / {}", company, key.roleFamily, key.levelBand, e)
                return null
            }.takeUnless { it.isEmpty }

        remember(key, Answer(loop, now.plus(properties.keptFor)))
        return loop
    }

    private fun remember(
        key: Key,
        answer: Answer,
    ) {
        if (answers.size >= properties.maxEntries) {
            val now = clock.instant()
            answers.entries.removeIf { !it.value.expiresAt.isAfter(now) }
            // Still full of live answers: drop the ones closest to expiring.
            if (answers.size >= properties.maxEntries) {
                answers.entries
                    .sortedBy { it.value.expiresAt }
                    .take(answers.size - properties.maxEntries + 1)
                    .forEach { answers.remove(it.key) }
            }
        }
        answers[key] = answer
    }

    private data class Key(
        val company: String,
        val roleFamily: String,
        val levelBand: String,
    )

    private class Answer(
        /** Null when the search found nothing citable — remembered so it is not re-billed. */
        val loop: GroundedEmployerLoop?,
        val expiresAt: Instant,
    )

    private companion object {
        const val MAX_COMPANY_LENGTH = 120
        val WHITESPACE = Regex("""\s+""")
    }
}

/**
 * @param enabled whether a brief for an unsourced employer runs a grounded web search.
 *   Off, those briefs show the archetype pattern alone, as they did before task 065.
 * @param keptFor how long one search's answer is reused. Bounded by how long the
 *   citation links stay valid, not by how often hiring processes change.
 * @param maxEntries how many (company, role, level) answers are held at once.
 */
@ConfigurationProperties(prefix = "interviewos.loop-brief.public-research")
data class PublicLoopResearchProperties(
    val enabled: Boolean = true,
    val keptFor: Duration = Duration.ofHours(12),
    val maxEntries: Int = 500,
)
