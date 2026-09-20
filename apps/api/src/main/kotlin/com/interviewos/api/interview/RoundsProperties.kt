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
    /**
     * Rounds a campus fresher is not given (task 048).
     *
     * System design is the one that matters. No campus loop contains it, a student has no
     * production system to reason from, and a report that marks them against a
     * distributed-systems bar tells them something untrue about how ready they are. The
     * engine therefore never selects it for a fresher, and a request for it is refused with
     * an explanation rather than run badly.
     *
     * A property rather than a constant because it is a product judgement the owner may
     * want to reverse — once there is a design round written for freshers, this list is
     * how it comes back, with no code change:
     *
     * ```yaml
     * interviewos:
     *   rounds:
     *     not-for-campus-freshers: []
     * ```
     */
    val notForCampusFreshers: List<String> = listOf(RoundType.SYSTEM_DESIGN.dbValue),
) {
    val offeredTypes: Set<RoundType> get() = offered.mapNotNull { RoundType.parseOrNull(it.trim()) }.toSet()

    val campusExcludedTypes: Set<RoundType>
        get() = notForCampusFreshers.mapNotNull { RoundType.parseOrNull(it.trim()) }.toSet()
}
