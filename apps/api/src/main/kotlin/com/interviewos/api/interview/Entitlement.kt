package com.interviewos.api.interview

/**
 * Whether a candidate may start another interview.
 *
 * Entitlement is derived from what actually happened — completed sessions and captured
 * payments — rather than stored as a flag, so it cannot drift out of sync with reality
 * (CLAUDE.md: progress is derived, not declared).
 *
 * The free tier is one *complete* interview including its report, because the report is
 * what sells the product. A session the candidate abandoned does not consume it: they
 * never saw the thing they came for.
 */
object Entitlement {
    const val FREE_COMPLETED_SESSIONS = 1

    fun evaluate(
        completedSessions: Int,
        paidSessionCredits: Int,
        sessionInProgress: Boolean,
    ): EntitlementDecision {
        if (sessionInProgress) {
            return EntitlementDecision(
                allowed = false,
                reason = Reason.SESSION_IN_PROGRESS,
                remainingFree = remainingFree(completedSessions),
            )
        }

        val allowance = FREE_COMPLETED_SESSIONS + paidSessionCredits
        if (completedSessions >= allowance) {
            return EntitlementDecision(
                allowed = false,
                reason = Reason.FREE_TIER_EXHAUSTED,
                remainingFree = 0,
            )
        }

        return EntitlementDecision(
            allowed = true,
            reason = Reason.ALLOWED,
            remainingFree = remainingFree(completedSessions),
        )
    }

    private fun remainingFree(completedSessions: Int): Int = (FREE_COMPLETED_SESSIONS - completedSessions).coerceAtLeast(0)

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
    val remainingFree: Int,
) {
    val message: String
        get() =
            when (reason) {
                Entitlement.Reason.ALLOWED -> {
                    "You can start an interview."
                }

                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    "You already have an interview in progress. Finish or leave it before starting another."
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    "Your free interview has been used. Upgrade to continue practising."
                }
            }
}
