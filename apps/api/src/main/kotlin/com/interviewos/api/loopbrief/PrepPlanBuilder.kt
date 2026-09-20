package com.interviewos.api.loopbrief

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.interview.RoundType

/**
 * One loop stage, shaped so the plan builder does not need to know whether it came from
 * a sourced document or the general pattern. [citations] is the tell: empty for a stage
 * the model wrote from archetype knowledge, one or more for a stage a fetched source
 * actually reports. Never mixed — a caller with no citations must never invent some.
 */
data class PlanStageInput(
    val order: Int?,
    val stageName: String,
    val assesses: String?,
    val roundType: RoundType?,
    val citations: List<BankCitation> = emptyList(),
)

data class PlanItem(
    val roundType: RoundType,
    val stageName: String,
    val focusAreas: List<String>,
    val suggestedMinutes: Int,
    /** Empty unless this item is tied to a stage a fetched source actually reports. */
    val citations: List<BankCitation>,
) {
    val isSourced: Boolean get() = citations.isNotEmpty()
}

data class UnsimulatedStage(
    val stageName: String,
    val note: String,
)

data class PrepPlanBuild(
    val items: List<PlanItem>,
    val unsimulatedStages: List<UnsimulatedStage>,
)

/**
 * Turns a loop into practice rounds. Pure and deterministic — no model call and nothing
 * to fall back from, which is itself the fallback the loop brief's general pattern
 * needed (`GeneralLoopPatternCache`): whatever loop it is handed, in whatever order,
 * this always produces a usable plan.
 *
 * Two rules do the real work:
 * - **A stage whose round type is not one this product runs is dropped**, not shown —
 *   a plan cannot offer a round `interviewos.rounds.offered` says does not exist.
 * - **A stage with no round type at all is not simulated.** It is not dropped; it
 *   becomes one of [PrepPlanBuild.unsimulatedStages], so the candidate is told what to
 *   do about the parts of the loop that are not a spoken round at all.
 */
object PrepPlanBuilder {
    /**
     * The stages a plan is built from: sourced first, then the general pattern after them.
     *
     * Sourced alone is not enough. A sourced loop rarely maps cleanly onto the rounds we
     * run — Amazon's own SDE II page describes an online assessment and an "Interview Loop"
     * of four 55-minute interviews, neither of which is one round type — so a plan built
     * only from sourced stages came back empty for exactly the employers we know most
     * about. The general pattern fills the round types the sources leave uncovered.
     *
     * Sourced stages still come first and still win a tie on round type (so the item keeps
     * its citation). General stages never carry a citation, and when sourced stages exist
     * a general stage with no round type is left out — the sources already say which parts
     * of the loop are not a spoken round, and a second, generic "not simulated" note for
     * the same thing would only be noise.
     */
    fun combine(
        sourced: List<PlanStageInput>,
        general: List<PlanStageInput>,
    ): List<PlanStageInput> {
        val after = sourced.mapNotNull { it.order }.maxOrNull() ?: 0
        val fill =
            general
                .filter { sourced.isEmpty() || it.roundType != null }
                .map { it.copy(order = it.order?.plus(after), citations = emptyList()) }
        return sourced + fill
    }

    fun build(
        offered: Set<RoundType>,
        stages: List<PlanStageInput>,
    ): PrepPlanBuild {
        val ordered = stages.sortedWith(compareBy(nullsLast()) { it.order })
        val seen = mutableSetOf<RoundType>()
        val items = mutableListOf<PlanItem>()
        val unsimulated = mutableListOf<UnsimulatedStage>()

        ordered.forEach { stage ->
            val roundType = stage.roundType
            if (roundType == null) {
                unsimulated += UnsimulatedStage(stage.stageName, unsimulatedNote(stage.stageName))
                return@forEach
            }
            if (roundType !in offered) return@forEach
            if (!seen.add(roundType)) return@forEach

            items +=
                PlanItem(
                    roundType = roundType,
                    stageName = stage.stageName,
                    focusAreas = focusAreasFor(stage, roundType),
                    suggestedMinutes = SUGGESTED_MINUTES[roundType] ?: DEFAULT_MINUTES,
                    citations = stage.citations,
                )
        }
        return PrepPlanBuild(items, unsimulated)
    }

    private fun focusAreasFor(
        stage: PlanStageInput,
        roundType: RoundType,
    ): List<String> {
        val fromStage =
            stage.assesses
                ?.split(FOCUS_SPLIT)
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                .orEmpty()
        return fromStage.ifEmpty { roundType.covers.take(MAX_FOCUS_AREAS) }.take(MAX_FOCUS_AREAS)
    }

    private fun unsimulatedNote(stageName: String): String {
        val lower = stageName.lowercase()
        return when {
            "assessment" in lower || "oa" == lower -> {
                "We don't run this as a spoken round. Practise it on a coding platform beforehand."
            }

            "team match" in lower || "matching" in lower -> {
                "This happens after the loop, once you have an offer to place — nothing to rehearse yet."
            }

            "offer" in lower || "negotiat" in lower -> {
                "This is a conversation with a recruiter, not an interview. Decide your numbers ahead of it."
            }

            "reference" in lower -> {
                "This is a check with people you name, not something to practise."
            }

            else -> {
                "We don't simulate this stage yet. Read what it involves and prepare for it separately."
            }
        }
    }

    private const val MAX_FOCUS_AREAS = 3
    private const val DEFAULT_MINUTES = 30
    private val FOCUS_SPLIT = Regex("[,;.]")

    private val SUGGESTED_MINUTES =
        mapOf(
            RoundType.CODING_PRACTICAL to 45,
            RoundType.SYSTEM_DESIGN to 45,
            RoundType.CASE_CLIENT_SCENARIO to 40,
            RoundType.TECHNICAL_FUNDAMENTALS to 30,
            RoundType.PROJECT_DEEP_DIVE to 30,
            RoundType.TECHNO_MANAGERIAL to 30,
            RoundType.BEHAVIOURAL_COMPETENCY to 30,
            RoundType.HR_FIT_CLOSING to 20,
            // Short on purpose: an aptitude round is a series of self-contained problems,
            // so it stops being informative long before a design case would.
            RoundType.APTITUDE to 25,
        )
}
