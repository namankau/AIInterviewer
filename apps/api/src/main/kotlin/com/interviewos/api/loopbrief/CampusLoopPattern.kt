package com.interviewos.api.loopbrief

import com.interviewos.api.ai.GeneralLoopPattern
import com.interviewos.api.ai.GeneralLoopStage
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.DeclaredStage
import com.interviewos.api.interview.RoundType

/**
 * The loop a student or new graduate is told to expect (task 052).
 *
 * Campus hiring is a different shape from lateral hiring, not an easier version of it:
 * a written test comes first, the spoken part is a technical interview on the syllabus
 * plus a project, and an HR conversation closes it. There is no system design and no
 * client-scenario round.
 *
 * **Archetype-level and written by us, not retrieved and not model-composed.** It says
 * how campus hiring at this *kind* of employer usually runs and names no employer, so it
 * cannot misstate one's process. Which is also why it needs no model call or cache row:
 * it is a fixed statement about the product's own rubric, and a cached model answer would
 * only be a second place for it to drift.
 */
object CampusLoopPattern {
    /** Rounds a fresher's plan never contains, whatever the model or a source names. */
    val EXCLUDED_FROM_PLAN: Set<RoundType> =
        setOf(RoundType.SYSTEM_DESIGN, RoundType.TECHNO_MANAGERIAL, RoundType.CASE_CLIENT_SCENARIO)

    /** True when [level] is a stated student or recent-graduate stage. Anything else, including null, is not. */
    fun isCampus(level: String?): Boolean =
        when (DeclaredStage.parseOrNull(level?.trim()?.lowercase())) {
            DeclaredStage.STUDENT, DeclaredStage.RECENT_GRADUATE -> true
            else -> false
        }

    fun forArchetype(archetype: Archetype): GeneralLoopPattern =
        GeneralLoopPattern(
            when (archetype) {
                Archetype.SERVICE_BASED_IT -> serviceIt()
                Archetype.GLOBAL_PRODUCT, Archetype.INDIAN_PRODUCT -> product()
                else -> generic()
            },
        )

    private fun serviceIt() =
        listOf(
            GeneralLoopStage(
                1,
                "Written aptitude test",
                "Online, timed, not spoken",
                "Quantitative aptitude, logical reasoning and verbal ability",
                RoundType.APTITUDE.dbValue,
            ),
            GeneralLoopStage(
                2,
                "Online coding test",
                "Online, not a spoken round",
                "Short programs or pseudocode in one language; practise on a coding platform beforehand",
            ),
            GeneralLoopStage(
                3,
                "Communication assessment (some employers)",
                "Online or recorded, not an interview with a person",
                "Listening, speaking, reading and writing in English; practise speaking in full, clear sentences",
            ),
            technical(
                "OOP, DBMS and SQL; operating systems and computer networks; your one language and DSA basics; final-year project or internship",
            ),
            hr(),
        )

    private fun product() =
        listOf(
            GeneralLoopStage(
                1,
                "Online coding assessment",
                "Online, timed, not a spoken round",
                "Data structures and algorithms problems; practise on a coding platform beforehand",
            ),
            GeneralLoopStage(
                2,
                "Coding interview",
                "Spoken, shared editor",
                "Arrays, strings, hashing, recursion, trees and complexity, explained out loud",
                RoundType.CODING_PRACTICAL.dbValue,
            ),
            technical("Core CS fundamentals; one language in depth; the final-year project or an internship", order = 3),
            GeneralLoopStage(
                4,
                "Behavioural interview",
                "Spoken",
                "Teamwork, handling feedback and something you got wrong, drawn from projects and college life",
                RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
            ),
            hr(order = 5),
        )

    private fun generic() =
        listOf(
            GeneralLoopStage(
                1,
                "Written test",
                "Online or on paper, not spoken",
                "Aptitude and reasoning, plus subject questions for the role",
                RoundType.APTITUDE.dbValue,
            ),
            technical("Core subject fundamentals from your degree; one project; a few applied questions", order = 2),
            hr(order = 3),
        )

    private fun technical(
        assesses: String,
        order: Int = 4,
    ) = GeneralLoopStage(
        order,
        "Technical interview",
        "Spoken",
        assesses,
        RoundType.TECHNICAL_FUNDAMENTALS.dbValue,
    )

    private fun hr(order: Int = 5) =
        GeneralLoopStage(
            order,
            "HR interview",
            "Spoken",
            "Tell me about yourself; why this employer; relocation, bond and shifts; higher studies",
            RoundType.HR_FIT_CLOSING.dbValue,
        )
}
