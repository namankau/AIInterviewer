package com.interviewos.api.interview

import com.interviewos.api.resume.ResumeUse

/** Mirrors the `round_type` Postgres enum and PRD §06. */
enum class RoundType(
    val dbValue: String,
    val label: String,
    val brief: String,
    /**
     * The ground this round has to get across, so the interviewer has somewhere to go
     * next besides deeper into the last answer.
     *
     * Not a script and not an order — a real interviewer moves between these as the
     * conversation allows. It is a breadth check: an interviewer with nowhere else to go
     * asks the same follow-up five times, which is what a round felt like before this
     * existed.
     */
    val covers: List<String>,
    /** Whether the candidate's CV is this round's subject, its context, or its examples. */
    val resumeUse: ResumeUse,
) {
    TECHNICAL_FUNDAMENTALS(
        "technical_fundamentals",
        "Technical fundamentals",
        "Probe depth of domain concepts, calibrated to the candidate's level. Reward precision over vocabulary.",
        covers =
            listOf(
                "OOP (object-oriented design) and SOLID principles, with a concrete trade-off rather than definitions alone",
                "Java language fundamentals and the collections framework, including equality, hashing and concurrency",
                "operating system fundamentals: processes, threads, memory, scheduling and deadlocks",
                "database fundamentals: modelling, indexes, transactions, isolation and query trade-offs",
                "foundational system design judgement: component boundaries, basic scale and explicit trade-offs",
            ),
        resumeUse = ResumeUse.CONTEXT,
    ),
    PROJECT_DEEP_DIVE(
        "project_deep_dive",
        "Project deep-dive",
        "Interrogate the candidate's own claims about their work. Ask what they personally decided, what they " +
            "traded off, and what they would do differently. Vague ownership is the thing to surface.",
        covers =
            listOf(
                "what the project actually had to do, and for whom",
                "the decision they personally made, and what they traded away",
                "what went wrong, and what they did about it",
                "what they would do differently now",
                "where their work ended and someone else's began",
            ),
        resumeUse = ResumeUse.SYLLABUS,
    ),
    CODING_PRACTICAL(
        "coding_practical",
        "Coding and practical problem solving",
        "Spoken reasoning about a practical problem. Assess approach, edge cases and complexity awareness rather " +
            "than syntax, since the candidate is speaking rather than typing.",
        covers =
            listOf(
                "how they scope the problem before writing anything",
                "the approach, and why it beats the alternative they discarded",
                "complexity, in time and space, argued rather than recited",
                "the cases it breaks on, found by them rather than supplied",
                "what they would test, and how they would know it worked",
            ),
        resumeUse = ResumeUse.CONTEXT,
    ),
    SYSTEM_DESIGN(
        "system_design",
        "System or solution design",
        "Requirements clarification, component design, data flow, failure modes, and explicit trade-offs.",
        covers =
            listOf(
                "requirements and scale, narrowed by them rather than handed over",
                "a high-level design that survives the numbers they were given",
                "the data model, and what it makes expensive",
                "failure modes: what breaks first, and what happens when it does",
                "one deep dive, chosen because their design made it the interesting question",
                "the trade-off they made, defended under push-back",
            ),
        resumeUse = ResumeUse.CONTEXT,
    ),
    CASE_CLIENT_SCENARIO(
        "case_client_scenario",
        "Case and client scenario",
        "A client situation to structure and work through aloud. Assess structuring, assumptions and " +
            "stakeholder judgement. Escalate the scenario as they get comfortable.",
        covers =
            listOf(
                "the structure they impose on an open problem, before any analysis",
                "the assumptions they state out loud, and the ones they smuggle",
                "sizing and arithmetic done aloud",
                "what they would actually tell the client, and what they would not",
                "the scenario escalated once they are comfortable",
            ),
        resumeUse = ResumeUse.SITUATIONS,
    ),
    TECHNO_MANAGERIAL(
        "techno_managerial",
        "Techno-managerial",
        "Delivery, estimation, escalation and stakeholder handling. Probe how they behave when a plan slips.",
        covers =
            listOf(
                "how they estimate, and what they do when the estimate is wrong",
                "the week a plan slipped: when they escalated, and to whom",
                "handling a stakeholder who wanted something they could not give",
                "how they decide what gets dropped",
                "what they do about someone on the team who is not delivering",
            ),
        resumeUse = ResumeUse.SITUATIONS,
    ),
    BEHAVIOURAL_COMPETENCY(
        "behavioural_competency",
        "Behavioural and competency",
        "Structured, evidence-based competency questions. Require specific situations, not general policy.",
        covers =
            listOf(
                "a specific situation, with a date and a person in it, not a policy",
                "disagreement: with a peer, and with someone more senior",
                "a failure they owned, and what changed afterwards",
                "how they behave under a deadline they cannot meet",
                "what they did when they were the only one who thought something was wrong",
            ),
        resumeUse = ResumeUse.SITUATIONS,
    ),

    /**
     * The gate most Indian campus candidates meet first, and the one that eliminates most
     * of them before any technical round (task 048, PRD §06).
     *
     * **Deliberately not a timed multiple-choice test.** A real aptitude test is sat in
     * silence against a clock, and an aggregator can already give a student one of those.
     * What this product can do, and they cannot, is make somebody say the working out loud:
     * how they set the problem up, which quantity they solved for first, what they did when
     * the arithmetic came out wrong. That is also the part a written test never reveals and
     * the part that transfers to the interview after it.
     *
     * So the round is spoken reasoning about aptitude material. An MCQ engine would be a
     * different product surface, and building one was explicitly left out of the task that
     * added this.
     */
    APTITUDE(
        "aptitude",
        "Aptitude and reasoning",
        "Quantitative, logical reasoning, data interpretation and verbal ability, worked out loud. Assess the " +
            "method, the assumptions stated, and the arithmetic they can carry in their head — not a marked " +
            "answer sheet. Give them nothing to write on that they would not have in the room.",
        covers =
            listOf(
                "a quantitative problem set up aloud: what they are solving for, before any arithmetic",
                "the arithmetic itself, carried in their head, including where they round and why that is safe",
                "a logical reasoning problem: what actually follows from what they were told, and what does not",
                "a small table or set of figures read aloud, and the one conclusion it supports",
                "an estimate with no exact answer, where the method is the entire assessment",
                "what they do when they notice halfway through that they have gone wrong",
            ),
        resumeUse = ResumeUse.CONTEXT,
    ),
    HR_FIT_CLOSING(
        "hr_fit_closing",
        "HR, fit and closing",
        "Notice period, compensation expectations, relocation, work authorisation and motivation. Be direct — " +
            "this is the least-rehearsed and highest-anxiety part of most loops.",
        covers =
            listOf(
                "notice period, and how firm it is",
                "compensation expectations, asked directly",
                "relocation and work authorisation",
                "why this employer, and why now",
                "what would make them turn an offer down",
            ),
        resumeUse = ResumeUse.SITUATIONS,
    ),
    CUSTOM_TOPIC(
        "custom_topic",
        "Custom topic",
        "Stay entirely within the candidate's chosen topic. Test breadth first, then deepen only the concepts " +
            "their answers make relevant.",
        covers =
            listOf(
                "the core concepts inside the candidate's chosen topic",
                "how those concepts behave in a concrete example",
                "common failure modes and misconceptions within that topic",
                "trade-offs and boundaries inside that topic",
            ),
        resumeUse = ResumeUse.CONTEXT,
    ),
    ;

    fun warmupTurns(durationMinutes: Int): Int =
        when (this) {
            CUSTOM_TOPIC -> 0
            PROJECT_DEEP_DIVE -> InterviewPlan.warmupTurnsFor(durationMinutes)
            else -> 1
        }

    val followUpLimit: Int
        get() = if (this == PROJECT_DEEP_DIVE || this == CUSTOM_TOPIC) 3 else 2

    companion object {
        fun fromDbValue(value: String): RoundType =
            entries.firstOrNull { it.dbValue == value }
                ?: throw IllegalArgumentException("Unknown round type: $value")

        fun parseOrNull(value: String): RoundType? = entries.firstOrNull { it.dbValue == value }
    }
}
