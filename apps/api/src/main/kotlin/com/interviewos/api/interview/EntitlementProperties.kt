package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * How many rounds a candidate gets before being asked to pay.
 *
 * Null — the default, and what is configured today — means no limit. There is no paid
 * tier to gate against yet, and the decision was to keep every round free until one
 * exists rather than turn away the people whose use of it is currently the most valuable
 * thing about it.
 *
 * Bringing the gate back is this one property:
 *
 * ```yaml
 * interviewos:
 *   entitlement:
 *     free-rounds: 1
 * ```
 *
 * Nothing else changes — [Entitlement] still does the arithmetic, and the tests over it
 * still cover both sides.
 */
@ConfigurationProperties(prefix = "interviewos.entitlement")
data class EntitlementProperties(
    val freeRounds: Int? = null,
)
