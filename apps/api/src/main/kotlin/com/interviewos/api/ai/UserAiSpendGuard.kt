package com.interviewos.api.ai

import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/** Checks the server-owned spend ledger before optional preparation or a new round. */
class UserAiSpendGuard(
    private val properties: AiBudgetProperties,
    private val spend: AiSpendReadModel,
    private val dayZone: ZoneId,
    private val now: () -> Instant = Instant::now,
) {
    fun reached(userId: UUID): Boolean {
        val cap = properties.perUserDailyCapMicroUsd
        if (cap <= 0) return false
        val since =
            now()
                .atZone(dayZone)
                .toLocalDate()
                .atStartOfDay(dayZone)
                .toInstant()
        return spend.spentByUserSince(userId, since) >= cap
    }
}
