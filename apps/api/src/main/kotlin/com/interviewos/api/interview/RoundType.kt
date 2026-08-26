package com.interviewos.api.interview

/** Mirrors the `round_type` Postgres enum and PRD §06. */
enum class RoundType(
    val dbValue: String,
    val label: String,
    val brief: String,
) {
    TECHNICAL_FUNDAMENTALS(
        "technical_fundamentals",
        "Technical fundamentals",
        "Probe depth of domain concepts, calibrated to the candidate's level. Reward precision over vocabulary.",
    ),
    PROJECT_DEEP_DIVE(
        "project_deep_dive",
        "Project deep-dive",
        "Interrogate the candidate's own claims about their work. Ask what they personally decided, what they " +
            "traded off, and what they would do differently. Vague ownership is the thing to surface.",
    ),
    CODING_PRACTICAL(
        "coding_practical",
        "Coding and practical problem solving",
        "Spoken reasoning about a practical problem. Assess approach, edge cases and complexity awareness rather " +
            "than syntax, since the candidate is speaking rather than typing.",
    ),
    SYSTEM_DESIGN(
        "system_design",
        "System or solution design",
        "Requirements clarification, component design, data flow, failure modes, and explicit trade-offs.",
    ),
    CASE_CLIENT_SCENARIO(
        "case_client_scenario",
        "Case and client scenario",
        "A client situation to structure and work through aloud. Assess structuring, assumptions and " +
            "stakeholder judgement. Escalate the scenario as they get comfortable.",
    ),
    TECHNO_MANAGERIAL(
        "techno_managerial",
        "Techno-managerial",
        "Delivery, estimation, escalation and stakeholder handling. Probe how they behave when a plan slips.",
    ),
    BEHAVIOURAL_COMPETENCY(
        "behavioural_competency",
        "Behavioural and competency",
        "Structured, evidence-based competency questions. Require specific situations, not general policy.",
    ),
    HR_FIT_CLOSING(
        "hr_fit_closing",
        "HR, fit and closing",
        "Notice period, compensation expectations, relocation, work authorisation and motivation. Be direct — " +
            "this is the least-rehearsed and highest-anxiety part of most loops.",
    ),
    ;

    companion object {
        fun fromDbValue(value: String): RoundType =
            entries.firstOrNull { it.dbValue == value }
                ?: throw IllegalArgumentException("Unknown round type: $value")

        fun parseOrNull(value: String): RoundType? = entries.firstOrNull { it.dbValue == value }
    }
}
