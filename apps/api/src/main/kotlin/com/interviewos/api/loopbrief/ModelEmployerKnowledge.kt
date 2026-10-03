package com.interviewos.api.loopbrief

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.EmployerKnowledge
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
 * What the model itself knows about one employer's process, for a brief that has
 * neither our sourced record nor a citable search result to stand on.
 *
 * The owner does not want a brief for an employer like Infosys to open with "we don't
 * hold a sourced account" and nothing specific after it. This is the last specific
 * source before the archetype pattern: the same cold knowledge check the question pool
 * uses (`assessEmployerKnowledge`), which names only rounds, values and formats the
 * model can actually name, and says how dated they may be. It is shown labelled as the
 * model's own knowledge — the `model_knowledge` tier — never as a report.
 *
 * Only an answer that claims the process *and* names something survives, for the same
 * reason `PoolAssociationGate` asks for both: "yes, I know them" with nothing behind it
 * is the failure the check exists to catch.
 *
 * Held in memory per employer. Unlike a search, it has no expiring links, so it is kept
 * longer; misses are kept too, so an employer the model does not know is asked once.
 */
@Component
class ModelEmployerKnowledge internal constructor(
    private val interviewAi: InterviewAi,
    private val properties: ModelEmployerKnowledgeProperties,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        interviewAi: InterviewAi,
        properties: ModelEmployerKnowledgeProperties,
    ) : this(interviewAi, properties, Clock.systemUTC())

    private val log = LoggerFactory.getLogger(javaClass)
    private val answers = ConcurrentHashMap<String, Answer>()

    fun knowledgeOf(
        companyName: String,
        archetype: String,
    ): EmployerKnowledge? {
        if (!properties.enabled) return null
        val company = companyName.trim().replace(WHITESPACE, " ")
        if (company.isEmpty() || company.length > MAX_COMPANY_LENGTH) return null

        val key = company.lowercase()
        val now = clock.instant()
        answers[key]?.takeIf { it.expiresAt.isAfter(now) }?.let { return it.knowledge }

        val knowledge =
            try {
                interviewAi.assessEmployerKnowledge(company, archetype).value
            } catch (e: AiUnavailableException) {
                // Not cached: an outage is not evidence that the model knows nothing.
                log.warn("Could not ask the model what it knows of {}", company, e)
                return null
            }.takeIf { it.knowsProcess && it.namesSomething }?.let(::cleaned)

        remember(key, Answer(knowledge, now.plus(properties.keptFor)))
        return knowledge
    }

    private fun cleaned(knowledge: EmployerKnowledge) =
        knowledge.copy(
            basis = knowledge.basis?.trim()?.takeIf { it.isNotEmpty() },
            namedRounds = knowledge.namedRounds.map { it.trim() }.filter { it.isNotEmpty() },
            namedValues = knowledge.namedValues.map { it.trim() }.filter { it.isNotEmpty() },
            namedFormats = knowledge.namedFormats.map { it.trim() }.filter { it.isNotEmpty() },
        )

    private fun remember(
        key: String,
        answer: Answer,
    ) {
        if (answers.size >= properties.maxEntries) {
            val now = clock.instant()
            answers.entries.removeIf { !it.value.expiresAt.isAfter(now) }
            if (answers.size >= properties.maxEntries) {
                answers.entries
                    .sortedBy { it.value.expiresAt }
                    .take(answers.size - properties.maxEntries + 1)
                    .forEach { answers.remove(it.key) }
            }
        }
        answers[key] = answer
    }

    private class Answer(
        /** Null when the model does not know this employer — remembered so it is not re-billed. */
        val knowledge: EmployerKnowledge?,
        val expiresAt: Instant,
    )

    private companion object {
        const val MAX_COMPANY_LENGTH = 120
        val WHITESPACE = Regex("""\s+""")
    }
}

/**
 * @param enabled whether a brief with nothing sourced or citable asks the model what it
 *   knows of the employer. Off, such a brief shows the archetype pattern alone.
 * @param keptFor how long one answer is reused. Model knowledge does not change between
 *   deploys, so this only bounds memory and lets a model upgrade show through.
 * @param maxEntries how many employers' answers are held at once.
 */
@ConfigurationProperties(prefix = "interviewos.loop-brief.model-knowledge")
data class ModelEmployerKnowledgeProperties(
    val enabled: Boolean = true,
    val keptFor: Duration = Duration.ofDays(7),
    val maxEntries: Int = 500,
)
