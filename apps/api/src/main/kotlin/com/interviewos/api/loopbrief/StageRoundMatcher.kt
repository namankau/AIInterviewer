package com.interviewos.api.loopbrief

import com.interviewos.api.interview.RoundType

/**
 * Which round type an employer's own stage name describes — "Technical interview",
 * "HR round", "Managerial interview" — or null when the name is not a spoken round we
 * could map with confidence (an online test, a group discussion, anything unrecognised).
 *
 * Deterministic keyword matching rather than a model call: the names come from the
 * model's knowledge check already, and asking a model again to classify its own words
 * would only add a second place for the answer to drift. Order matters — a
 * "Technical managerial round" is the managerial round, not the fundamentals one.
 */
object StageRoundMatcher {
    fun match(stageName: String): RoundType? {
        val name = stageName.lowercase()
        val words = WORD.findAll(name).map { it.value }.toSet()
        return when {
            "manager" in name || "managerial" in name -> RoundType.TECHNO_MANAGERIAL

            "hr" in words || "human resource" in name || "fitment" in name -> RoundType.HR_FIT_CLOSING

            "system design" in name || "design round" in name -> RoundType.SYSTEM_DESIGN

            "case" in words || "client" in name -> RoundType.CASE_CLIENT_SCENARIO

            "project" in name -> RoundType.PROJECT_DEEP_DIVE

            "behaviour" in name || "behavior" in name || "competenc" in name -> RoundType.BEHAVIOURAL_COMPETENCY

            // A test is taken on a platform, not spoken — even an aptitude or coding one.
            ONLINE_TEST.any { it in name } || "test" in words || "oa" in words -> null

            "aptitude" in name || "reasoning" in name -> RoundType.APTITUDE

            "coding" in name || "programming" in name || "dsa" in words -> RoundType.CODING_PRACTICAL

            "technical" in name || "tech" in words -> RoundType.TECHNICAL_FUNDAMENTALS

            else -> null
        }
    }

    private val WORD = Regex("[a-z]+")
    private val ONLINE_TEST = listOf("online", "assessment", "exam", "hackathon", "contest", "nqt")
}
