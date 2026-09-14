package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Which round types this product actually runs, as opposed to every round type a
 * source might describe an employer's loop containing.
 *
 * Defaults to every `RoundType` — everything the catalogue offers today. The property
 * exists so a plan or a brief can drop a round type without a code change: a stage that
 * maps to a round type outside this list is treated the same as one that maps to none,
 * because a plan cannot offer a round this product does not run.
 *
 * ```yaml
 * interviewos:
 *   rounds:
 *     offered: [coding_practical, system_design, behavioural_competency]
 * ```
 */
@ConfigurationProperties(prefix = "interviewos.rounds")
data class RoundsProperties(
    val offered: List<String> = RoundType.entries.map { it.dbValue },
) {
    val offeredTypes: Set<RoundType> get() = offered.mapNotNull { RoundType.parseOrNull(it.trim()) }.toSet()
}
