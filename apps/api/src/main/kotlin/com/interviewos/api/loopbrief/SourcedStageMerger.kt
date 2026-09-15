package com.interviewos.api.loopbrief

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.interview.RoundType

/**
 * One loop stage, as the brief shows it: the same stage reported by two sources is one
 * of these with two citations, not two rows the candidate has to reconcile themselves.
 */
data class SourcedStage(
    val stageName: String,
    val roleFamily: String?,
    val order: Int?,
    val format: String?,
    val durationMinutes: Int?,
    val assesses: String?,
    val roundType: RoundType?,
    val citations: List<BankCitation>,
)

/**
 * Merges per-source stage reports into the ordered list a brief shows.
 *
 * Pure, so the merge rule is tested without a database. Two reports are "the same
 * stage" when their names agree once case and surrounding space are ignored — a
 * document-specific spelling like "Bar Raiser" and "bar raiser" is one stage, and a
 * genuinely different stage a source names differently stays separate, which is the
 * honest answer when nothing says otherwise.
 */
object SourcedStageMerger {
    fun merge(rows: List<SourceProcessStageRow>): List<SourcedStage> =
        rows
            .groupBy { it.stageName.trim().lowercase() }
            .values
            .map { group ->
                SourcedStage(
                    stageName = group.first().stageName.trim(),
                    roleFamily = group.firstNotNullOfOrNull { it.roleFamily },
                    order = group.mapNotNull { it.stageOrder }.minOrNull(),
                    format = group.firstNotNullOfOrNull { it.format },
                    durationMinutes = group.mapNotNull { it.durationMinutes }.minOrNull(),
                    assesses = group.firstNotNullOfOrNull { it.assesses },
                    roundType = group.firstNotNullOfOrNull { it.roundType },
                    // One source repeating itself is one citation, the same rule the
                    // bank applies to corroboration.
                    citations = group.map { it.citation }.distinctBy { it.sourceId },
                )
            }.sortedWith(compareBy(nullsLast()) { it.order })
}
