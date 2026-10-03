package com.interviewos.api.loopbrief

import com.interviewos.api.interview.RoundType
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.assertEquals

class StageRoundMatcherTest {
    @ParameterizedTest
    @CsvSource(
        "Technical interview, TECHNICAL_FUNDAMENTALS",
        "Tech round, TECHNICAL_FUNDAMENTALS",
        "HR interview, HR_FIT_CLOSING",
        "Technical managerial round, TECHNO_MANAGERIAL",
        "Manager round, TECHNO_MANAGERIAL",
        "System design interview, SYSTEM_DESIGN",
        "Coding interview, CODING_PRACTICAL",
        "Project discussion, PROJECT_DEEP_DIVE",
        "Behavioural interview, BEHAVIOURAL_COMPETENCY",
        "Client case round, CASE_CLIENT_SCENARIO",
        "Aptitude interview, APTITUDE",
    )
    fun `a spoken round is matched by what it is called`(
        name: String,
        expected: RoundType,
    ) {
        assertEquals(expected, StageRoundMatcher.match(name))
    }

    @ParameterizedTest
    @CsvSource(
        "Online assessment",
        "Aptitude test",
        "Online coding test",
        "HackWithInfy",
        "TCS NQT",
        "Group discussion",
        "Shrink-wrapped",
    )
    fun `a test taken on a platform, or anything unrecognised, is not a spoken round`(name: String) {
        assertEquals(null, StageRoundMatcher.match(name))
    }
}
