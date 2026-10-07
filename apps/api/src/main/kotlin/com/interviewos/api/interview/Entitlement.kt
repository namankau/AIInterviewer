package com.interviewos.api.interview

/**
 * Whether a candidate may start another interview.
 *
 * Entitlement is derived from what actually happened — completed sessions, captured
 * payments and the rounds started today — rather than stored as a flag, so it cannot
 * drift out of sync with reality (CLAUDE.md: progress is derived, not declared).
 *
 * Checked in this order, and the order is the message the candidate sees:
 *
 * 1. **One interview at a time.** Not commercial, and stays whatever the plan: two live
 *    sessions would race each other's turns.
 * 2. **Lifetime free rounds**, when `interviewos.entitlement.free-rounds` is set. Unset
 *    today. It counts *complete* interviews, because the report is what sells the product
 *    and an abandoned round never showed it.
 * 3. **The daily allowance**: rounds started today, then planned minutes used today, then
 *    whether the requested round fits in what is left. Started, not completed, because the
 *    model is paid for from the first question — an abandoned round has already cost money.
 */
object Entitlement {
    /**
     * @param freeRounds how many completed rounds a candidate gets before paying, or null
     *   for no limit at all.
     * @param requestedMinutes the length of the round being started, or null when only
     *   asking whether a round could be started at all (the dashboard).
     */
    fun evaluate(
        completedSessions: Int,
        paidSessionCredits: Int,
        sessionInProgress: Boolean,
        freeRounds: Int?,
        daily: DailyUsage = DailyUsage.UNLIMITED,
        requestedMinutes: Int? = null,
    ): EntitlementDecision {
        val remaining = remainingFree(freeRounds, completedSessions)

        fun decision(reason: Reason) =
            EntitlementDecision(
                allowed = reason == Reason.ALLOWED,
                reason = reason,
                remainingFree = if (reason == Reason.FREE_TIER_EXHAUSTED) 0 else remaining,
                daily = daily,
            )

        if (sessionInProgress) return decision(Reason.SESSION_IN_PROGRESS)
        if (freeRounds != null && completedSessions >= freeRounds + paidSessionCredits) {
            return decision(Reason.FREE_TIER_EXHAUSTED)
        }
        if (daily.remainingRounds == 0) return decision(Reason.DAILY_ROUNDS_REACHED)
        if (daily.remainingMinutes == 0) return decision(Reason.DAILY_MINUTES_REACHED)
        val minutesLeft = daily.remainingMinutes
        if (requestedMinutes != null && minutesLeft != null && requestedMinutes > minutesLeft) {
            return decision(Reason.DAILY_MINUTES_SHORT)
        }
        return decision(Reason.ALLOWED)
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

        /** Today's free rounds have all been started. */
        DAILY_ROUNDS_REACHED,

        /** Today's free minutes have all been used. */
        DAILY_MINUTES_REACHED,

        /** Some minutes are left today, but fewer than the round asked for. */
        DAILY_MINUTES_SHORT,
    }
}

/**
 * Today's practice so far, against the daily allowance. A null limit means that allowance
 * is switched off, and its remaining count is then null too.
 */
data class DailyUsage(
    val roundsUsed: Int,
    val minutesUsed: Int,
    val roundLimit: Int?,
    val minuteLimit: Int?,
) {
    val remainingRounds: Int? get() = roundLimit?.let { (it - roundsUsed).coerceAtLeast(0) }
    val remainingMinutes: Int? get() = minuteLimit?.let { (it - minutesUsed).coerceAtLeast(0) }

    companion object {
        val UNLIMITED = DailyUsage(roundsUsed = 0, minutesUsed = 0, roundLimit = null, minuteLimit = null)
    }
}

data class EntitlementDecision(
    val allowed: Boolean,
    val reason: Entitlement.Reason,
    /** How many free rounds are left, or null when there is no limit. */
    val remainingFree: Int?,
    val daily: DailyUsage = DailyUsage.UNLIMITED,
) {
    val message: String
        get() =
            when (reason) {
                Entitlement.Reason.ALLOWED -> {
                    when {
                        daily.roundLimit != null || daily.minuteLimit != null -> {
                            "Free practice today: ${allowanceLeft()}."
                        }

                        remainingFree == null -> {
                            "Every round is free while we are building this. Practise as often as you like."
                        }

                        else -> {
                            "You can start an interview."
                        }
                    }
                }

                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    "You already have an interview in progress. Finish or leave it before starting another."
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    "Your free interview has been used. Upgrade to continue practising."
                }

                Entitlement.Reason.DAILY_ROUNDS_REACHED, Entitlement.Reason.DAILY_MINUTES_REACHED -> {
                    "You have used today's free practice (${allowanceSummary()}). It resets at midnight, " +
                        "India time. Pro, with more practice each day, is coming soon."
                }

                Entitlement.Reason.DAILY_MINUTES_SHORT -> {
                    "You have ${daily.remainingMinutes} minutes of free practice left today. " +
                        "Choose a round of ${daily.remainingMinutes} minutes or less."
                }
            }

    private fun allowanceLeft(): String =
        listOfNotNull(
            daily.remainingRounds?.let { "$it ${if (it == 1) "round" else "rounds"}" },
            daily.remainingMinutes?.let { "$it minutes" },
        ).joinToString(" and ") + " left"

    private fun allowanceSummary(): String =
        listOfNotNull(
            daily.roundLimit?.let { "$it ${if (it == 1) "round" else "rounds"}" },
            daily.minuteLimit?.let { "$it minutes" },
        ).joinToString(" or ") + " a day"
}
