package com.interviewos.api.interview

/**
 * Whether a candidate may start another interview.
 *
 * Entitlement is derived from what actually happened — completed sessions and captured
 * payments — rather than stored as a flag, so it cannot drift out of sync with reality
 * (CLAUDE.md: progress is derived, not declared).
 *
 * **There is no round limit at the moment.** `interviewos.entitlement.free-rounds` is
 * unset, which means unlimited: there is no paid tier to gate against yet, and a limit on
 * an unproven product costs feedback worth more than the model calls it saves. Setting
 * that property to a number brings the allowance back with no other change — the
 * arithmetic below and the tests over it are unchanged, which is the point of leaving
 * them in place rather than deleting them.
 *
 * The one restriction that is *not* commercial, and stays either way: one interview at a
 * time. Two live sessions would race each other's turns.
 *
 * When the allowance does come back it counts *complete* interviews, including the
 * report, because the report is what sells the product. A session the candidate abandoned
 * does not consume it: they never saw the thing they came for.
 */
object Entitlement {
    /**
     * @param freeRounds how many completed rounds a candidate gets before paying, or null
     *   for no limit at all.
     */
    fun evaluate(
        completedSessions: Int,
        paidSessionCredits: Int,
        sessionInProgress: Boolean,
        freeRounds: Int?,
    ): EntitlementDecision {
        if (sessionInProgress) {
            return EntitlementDecision(
                allowed = false,
                reason = Reason.SESSION_IN_PROGRESS,
                remainingFree = remainingFree(freeRounds, completedSessions),
            )
        }

        if (freeRounds != null && completedSessions >= freeRounds + paidSessionCredits) {
            return EntitlementDecision(
                allowed = false,
                reason = Reason.FREE_TIER_EXHAUSTED,
                remainingFree = 0,
            )
        }

        return EntitlementDecision(
            allowed = true,
            reason = Reason.ALLOWED,
            remainingFree = remainingFree(freeRounds, completedSessions),
        )
    }

    /** Null means there is no allowance to count down — not that none is left. */
    private fun remainingFree(
        freeRounds: Int?,
        completedSessions: Int,
    ): Int? = freeRounds?.let { (it - completedSessions).coerceAtLeast(0) }

    enum class Reason {
        ALLOWED,

        /** One interview at a time — finish or abandon the open one first. */
        SESSION_IN_PROGRESS,

        FREE_TIER_EXHAUSTED,
    }
}

data class EntitlementDecision(
    val allowed: Boolean,
    val reason: Entitlement.Reason,
    /** How many free rounds are left, or null when there is no limit. */
    val remainingFree: Int?,
) {
    val message: String
        get() =
            when (reason) {
                Entitlement.Reason.ALLOWED -> {
                    if (remainingFree == null) {
                        "Every round is free while we are building this. Practise as often as you like."
                    } else {
                        "You can start an interview."
                    }
                }

                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    "You already have an interview in progress. Finish or leave it before starting another."
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    "Your free interview has been used. Upgrade to continue practising."
                }
            }
}
