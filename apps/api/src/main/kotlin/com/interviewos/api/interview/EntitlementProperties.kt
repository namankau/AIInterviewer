package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.ZoneId

/**
 * How much free practice a candidate gets.
 *
 * Two separate allowances:
 *
 * - **Lifetime** ([freeRounds]): how many completed rounds before paying. Null — the
 *   default — means no lifetime limit. Bringing that gate back is `free-rounds: 1`;
 *   [Entitlement] already does the arithmetic and the tests cover both sides.
 * - **Daily** ([dailyRounds], [dailyMinutes]): how many rounds may be *started*, and how
 *   many planned minutes they may add up to, per calendar day in [dayZone]. This is what
 *   keeps the model bill bounded while every round is free (owner decision, 7 Oct 2026:
 *   2 rounds and 60 minutes a day). Null switches either one off.
 *
 * The day is India's because the product is India-first; a candidate elsewhere still gets
 * the same allowance, it just resets at a different hour of their day.
 */
@ConfigurationProperties(prefix = "interviewos.entitlement")
data class EntitlementProperties(
    val freeRounds: Int? = null,
    val dailyRounds: Int? = 2,
    val dailyMinutes: Int? = 60,
    val dayZone: ZoneId = ZoneId.of("Asia/Kolkata"),
)
