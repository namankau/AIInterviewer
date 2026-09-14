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
            "assessment" in lower || "oa" == lower ->
                "We don't run this as a spoken round. Practise it on a coding platform beforehand."
            "team match" in lower || "matching" in lower ->
                "This happens after the loop, once you have an offer to place — nothing to rehearse yet."
            "offer" in lower || "negotiat" in lower ->
                "This is a conversation with a recruiter, not an interview. Decide your numbers ahead of it."
            "reference" in lower ->
                "This is a check with people you name, not something to practise."
            else -> "We don't simulate this stage yet. Read what it involves and prepare for it separately."
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
        )
}
