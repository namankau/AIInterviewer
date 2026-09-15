package com.interviewos.api.loopbrief

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.GeneralLoopPattern
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.interview.Archetype
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * The general pattern, cached per (archetype, role family, level band) and never
 * written from a call that has seen the candidate's company.
 *
 * A cache hit costs nothing. A miss costs one model call, the same shape as
 * `extractQuestions` — structured text, no company name in the prompt — and the answer
 * is written back so the next candidate in the same bucket does not pay for it again.
 */
@Component
class GeneralLoopPatternCache(
    private val repository: GeneralLoopPatternRepository,
    private val interviewAi: InterviewAi,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun patternFor(
        archetype: Archetype,
        role: String?,
        level: String?,
    ): GeneralLoopPattern {
        val roleFamily = LoopBucket.roleFamily(role)
        val levelBand = LoopBucket.levelBand(level)

        repository.find(archetype, roleFamily, levelBand)?.let { cached ->
            return runCatching { objectMapper.readValue(cached, GeneralLoopPattern::class.java) }
                .getOrElse { fallback(archetype) }
        }

        return try {
            val result = interviewAi.composeLoopPattern(archetype.label, roleFamily, levelBand)
            repository.save(archetype, roleFamily, levelBand, objectMapper.writeValueAsString(result.value))
            result.value
        } catch (e: AiUnavailableException) {
            log.warn("Could not compose a general loop pattern for {} / {} / {}", archetype, roleFamily, levelBand, e)
            fallback(archetype)
        }
    }

    /**
     * A single, honest stage rather than a broken page: what the archetype's own
     * emphasis already says, with no round type attached — nothing here claims to map
     * onto a round this product runs.
     */
    private fun fallback(archetype: Archetype): GeneralLoopPattern =
        GeneralLoopPattern(
            stages =
                listOf(
                    GeneralLoopStage(
                        order = 1,
                        stageName = "Usual emphasis for ${archetype.label.lowercase()}",
                        assesses = archetype.roundEmphasis,
                    ),
                ),
        )
}
