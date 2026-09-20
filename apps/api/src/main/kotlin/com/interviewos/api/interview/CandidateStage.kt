package com.interviewos.api.interview

import com.interviewos.api.pool.Level

/**
 * Who is actually in the room, and what that means the round is allowed to be (task 048).
 *
 * [Level] already existed, and until now almost nothing behaved differently for a fresher:
 * the model was told "0 years of experience" and left to work the rest out. It does not.
 * Handed a final-year student it asks what happened when the service fell over in
 * production, marks them against someone who has shipped, and writes them a report about
 * ownership they had no opportunity to show. That is the clearest way this product fails
 * the people campus placement season is about.
 *
 * So the stage is derived once, server-side, and carried into the brief, the round's
 * ground, the interviewer's bar and the report's bar — the same rule that keeps question
 * selection and scoring out of the model's hands (CLAUDE.md).
 *
 * **Nothing here is a claim about any employer.** It describes how *this kind of hiring*
 * is interviewed, which is a statement about the product's own rubric, not about TCS,
 * Infosys or anybody else's process. Where a specific employer's campus process would have
 * to be invented to be concrete, the wording stays general on purpose.
 */
data class CandidateStage(
    val level: Level,
    /**
     * True when this is a student or a new graduate: no professional history to interview
     * about, and a bar that has to be set against coursework rather than shipped work.
     *
     * Deliberately narrower than `level == ENTRY`. Somebody eighteen months into their
     * first job is entry level and is *not* a campus fresher — asking them about their
     * final-year project instead of their job would be the same mistake in the other
     * direction.
     */
    val campusFresher: Boolean,
) {
    /** How the candidate's own standing is described to the model. Never asserted back at them as fact. */
    val candidateDescription: String
        get() =
            if (campusFresher) {
                "a student or new graduate — the resume shows no professional work history"
            } else {
                level.label.lowercase()
            }

    /** The bar the round is pitched at, as the model is told it. */
    val targetDescription: String
        get() = if (campusFresher) "${level.label} — campus and new-graduate hiring" else level.label

    /**
     * The ground this round has to get across for this candidate.
     *
     * A round type's own [RoundType.covers] is written for somebody with a job. Four of
     * them ask a student about work they have not done, and an interviewer with nowhere
     * else to go asks them anyway. Where a campus version exists it replaces the list
     * outright rather than being appended to it — a list that still contains "the week a
     * plan slipped" will still be used.
     */
    fun covers(roundType: RoundType): List<String> = if (campusFresher) CampusRounds.covers(roundType) else roundType.covers

    /**
     * What the interviewer is told about the bar, injected into every prompt that conducts
     * the round. Short on purpose: it rides on every turn, and an instruction nobody reads
     * costs the candidate latency.
     */
    fun interviewerCalibration(): String =
        if (campusFresher) {
            CAMPUS_INTERVIEWER
        } else {
            when (level) {
                Level.ENTRY -> {
                    "Pitch this at somebody early in their first job. They have shipped something, but not much, " +
                        "and not at scale. Judge them on whether they understand what they built and what it cost, " +
                        "not on breadth they have not had time to acquire."
                }

                Level.MID -> {
                    "Pitch this at somebody with a few years behind them. Expect the concept applied to a real " +
                        "situation with one wrinkle in it, and expect them to name the trade-off they made."
                }

                Level.SENIOR -> {
                    "Pitch this at a senior engineer. Expect trade-offs defended under push-back, and an answer " +
                        "that accounts for what the choice costs elsewhere."
                }

                Level.STAFF -> {
                    "Pitch this at staff level. Expect failure modes, second-order effects, and how they would " +
                        "have known before a customer told them."
                }
            }
        }

    /**
     * What the report is told about the bar.
     *
     * A fresher's report has a different job from a senior's. A senior wants to know how
     * they did; a student wants to know what to study next, because there is still time to
     * study it. Instructive, not softer — the scale in the report prompt is unchanged, and
     * telling a student they did well when they did not is the failure that prompt exists
     * to prevent.
     */
    fun reportCalibration(): String =
        if (campusFresher) {
            CAMPUS_REPORT
        } else {
            "Score against what ${level.label.lowercase()} demands of this function. " +
                "Do not mark a candidate down for ground the interviewer never took them to."
        }

    companion object {
        private val CAMPUS_INTERVIEWER =
            """
            **This round is campus and new-graduate hiring.** The role they named is a fresher role and there
            is no professional work history behind them. Interview them accordingly, and do not assert any of
            this back at them as a fact about their life — ask.

            - Judge every answer against what a final-year student can reasonably know from coursework,
              their own projects and at most an internship. Not against somebody who has shipped and run
              software for a living.
            - Their material is coursework, college and final-year projects, internships, clubs, and whatever
              they built for themselves. Ask about that.
            - **Do not ask what happened when it broke in production, how they handled being on call, how they
              managed a stakeholder, or what they did when the plan slipped on a team they led.** They have not
              been there. A question with nowhere to stand teaches them nothing and tells you nothing.
            - The fresher version of ownership is this: what they personally wrote as against what a teammate,
              a tutorial or a library wrote; why they chose that library or that approach; what they would do
              differently now; and whether they understand the code they submitted. Push there instead, and
              push properly — it separates candidates far better than scale questions do.
            - They are nervous and it is probably their first interview of any kind. Be warm, ask one thing at
              a time, and give them a moment. None of that means going easy on the answer.
            """.trimIndent()

        private val CAMPUS_REPORT =
            """
            **This was campus and new-graduate hiring.** Score against what a final-year student can reasonably
            know from coursework, their own projects and at most an internship — not against somebody who has
            shipped for a living. Do not mark them down for production experience, scale, on-call or
            stakeholder handling: nobody at this stage has any, and the round should not have asked.

            Write it so they know what to do on Monday. For every gap, name the specific thing to study or
            practise next — the topic, and the kind of question it gets asked as — rather than a quality to
            improve. "Revise how a database index is chosen, and practise saying why a query is slow out loud"
            is useful; "deepen your fundamentals" is not. Stay anchored to what they actually said: a quote
            they did not say, or a remark about how they looked, is fabricated evidence whoever it is written
            for.
            """.trimIndent()

        /**
         * Below this many months of professional experience, an entry-level candidate is
         * treated as a campus fresher. A year is the line because it is roughly where a
         * candidate stops answering "what have you built" with their final-year project.
         */
        const val CAMPUS_BELOW_MONTHS = 12

        /**
         * The stage this round is run at.
         *
         * [roleTitle] is the job being applied *to*, and it wins when it says anything: a
         * candidate who typed "Graduate Engineer Trainee" is practising for a fresher round
         * whatever their resume says. [experienceMonths] is what the resume works out to,
         * and it decides when the title is silent. [statedLevel] is free text the candidate
         * or the round composer supplied ("fresher", "2026 batch"), matched the same way as
         * the title.
         *
         * [declaredStage] is different from all three: it is the candidate answering a
         * direct question about where they are (task 051), and it wins over everything
         * above rather than feeding into the same keyword match. The title and resume are a
         * guess; an answer the candidate actually gave is not, in either direction — a
         * stated professional is not read as a fresher because their resume is thin, and a
         * stated student is not read as mid-level because their title says "Software
         * Engineer" with nothing else behind it.
         *
         * A candidate with no resume and an unremarkable title, who stated nothing, is mid
         * level, as before — guessing "fresher" from an empty profile would pitch a working
         * engineer's round at a student, which is the mirror image of the bug this fixes.
         */
        fun of(
            roleTitle: String,
            experienceMonths: Int?,
            statedLevel: String? = null,
            declaredStage: DeclaredStage? = null,
        ): CandidateStage {
            val title = listOfNotNull(roleTitle.takeIf { it.isNotBlank() }, statedLevel?.takeIf { it.isNotBlank() }).joinToString(" ")
            val level = PoolRoundCoordinate.level(title, experienceMonths)
            return when (declaredStage) {
                DeclaredStage.STUDENT, DeclaredStage.RECENT_GRADUATE -> {
                    CandidateStage(Level.ENTRY, campusFresher = true)
                }

                DeclaredStage.PROFESSIONAL -> {
                    CandidateStage(level, campusFresher = false)
                }

                null -> {
                    val campus = level == Level.ENTRY && (experienceMonths == null || experienceMonths < CAMPUS_BELOW_MONTHS)
                    CandidateStage(level, campus)
                }
            }
        }
    }
}

/**
 * A candidate saying, in as many words, where they are (task 051).
 *
 * `StartSessionRequest` has no other way for someone to correct the derivation in
 * [CandidateStage.of] — the round type, company and role are the only things it captures
 * about who is sitting the round. Optional, and matched exactly: an unrecognised value is
 * a `400`, the same treatment `RoundType.parseOrNull` gives an unknown round, rather than
 * being silently ignored.
 */
enum class DeclaredStage(
    val wireValue: String,
) {
    /** Still studying — a final-year or earlier student. */
    STUDENT("student"),

    /** Graduated, no professional job yet. Read the same as [STUDENT]: no work history to interview about. */
    RECENT_GRADUATE("recent_graduate"),

    /** Currently working. Read as *not* a campus fresher even when the title or resume alone would suggest one. */
    PROFESSIONAL("professional"),
    ;

    companion object {
        fun parseOrNull(value: String?): DeclaredStage? = value?.let { v -> entries.firstOrNull { it.wireValue == v } }
    }
}

/**
 * What each round type is actually about when the candidate is a fresher.
 *
 * Kept beside [RoundType] rather than inside it because it is a second list, not a
 * variation on the first: a campus project deep-dive and a professional one share a name
 * and almost nothing else. A round type with no entry here needs none — a coding round or
 * an aptitude round asks a student the same thing it asks anybody.
 */
object CampusRounds {
    fun covers(roundType: RoundType): List<String> = CAMPUS[roundType] ?: roundType.covers

    /** The round types whose ground changes for a fresher. Public so a test can hold the line. */
    val CALIBRATED: Set<RoundType> get() = CAMPUS.keys

    private val CAMPUS: Map<RoundType, List<String>> =
        mapOf(
            RoundType.PROJECT_DEEP_DIVE to
                listOf(
                    "the project itself — what it had to do, and whether it was coursework, a final-year " +
                        "project, an internship or something they built for themselves",
                    "which parts they personally wrote, and which a teammate, a tutorial or a library wrote",
                    "why they chose that language, framework or library, when they could have chosen another",
                    "whether they can explain the code they submitted — pick something specific in it and ask",
                    "what broke while they were building it, and how they worked out why",
                    "what they would do differently if they started it again now",
                ),
            RoundType.TECHNICAL_FUNDAMENTALS to
                listOf(
                    "a core concept from their syllabus — operating systems, DBMS, computer networks or " +
                        "object-oriented programming — taken past the definition",
                    "why the standard approach is the standard one, and what it is protecting against",
                    "the same concept as it shows up in something they actually built",
                    "a basic data structure or algorithm choice, and why it beats the obvious alternative",
                    "one language they claim on the resume, at the level of how it behaves rather than syntax",
                ),
            RoundType.BEHAVIOURAL_COMPETENCY to
                listOf(
                    "a specific situation from a project, a team assignment, a club or a college society — " +
                        "not a policy, and not a job they have not had",
                    "a disagreement inside a group project, and what they did about it",
                    "something they got wrong, and what changed afterwards",
                    "how they worked when a submission deadline was going to be missed",
                    "how the group split the work, and what happened to the part nobody wanted",
                ),
            RoundType.TECHNO_MANAGERIAL to
                listOf(
                    "how they planned a project with a fixed submission date, and how close the plan came",
                    "what they did when a teammate's part was not going to arrive in time",
                    "when they asked a guide, a senior or a lab assistant for help, and when they did not",
                    "what they dropped to finish, and how they decided",
                    "how they would explain a delay to somebody who is not technical",
                ),
            RoundType.HR_FIT_CLOSING to
                listOf(
                    "why this employer, asked properly — and whether the answer survives a second question",
                    "relocation, and what they would actually say to an offer in a city they did not choose",
                    "how they feel about a service agreement or bond, where an offer comes with one",
                    "whether they are willing to be trained onto whatever technology they are put on, " +
                        "including one they have never touched",
                    "the gap between what they studied and what the role does day to day",
                    "what they expect the first year to be like, and where that expectation came from",
                ),
        )
}
