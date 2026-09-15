package com.interviewos.api.interview

import com.interviewos.api.pool.Association
import com.interviewos.api.pool.CodingPoolPayload
import com.interviewos.api.pool.Level
import com.interviewos.api.pool.PoolCoordinate
import com.interviewos.api.pool.PoolProblemExample
import com.interviewos.api.pool.PoolProblemTestCase
import com.interviewos.api.pool.PoolQuestion
import com.interviewos.api.pool.RoleFamily
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.util.UUID

/** Pool questions for tests, shaped the way `QuestionPoolRepository` returns them. */
object PoolFixtures {
    val mapper: JsonMapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()

    fun question(
        text: String,
        companyId: UUID? = BankFixtures.amazon.id,
        archetype: Archetype = Archetype.GLOBAL_PRODUCT,
        roundType: RoundType = RoundType.BEHAVIOURAL_COMPETENCY,
        level: Level = Level.MID,
        association: Association = Association.EMPLOYER_KIND,
        knowledgeBasis: String? = null,
        payload: JsonNode? = null,
        id: UUID = UUID.nameUUIDFromBytes("pool:$text:$companyId:$level".toByteArray()),
    ) = PoolQuestion(
        id = id,
        coordinate = PoolCoordinate(companyId, archetype, roundType, RoleFamily.BACKEND, level),
        text = text,
        followUps = listOf("What would you do differently?"),
        strongAnswerCovers = listOf("names a specific decision"),
        association = association,
        knowledgeBasis = knowledgeBasis,
        generatorVersion = 1,
        model = "gemini-test",
        fingerprint = "fp-$id",
        reviewedAt = null,
        retiredAt = null,
        payload = payload,
    )

    /** A verified coding problem as task 040 stores it — no solution anywhere in it. */
    fun codingPayload(testsVerified: Boolean = true): JsonNode =
        mapper.valueToTree(
            CodingPoolPayload(
                topic = "sliding window",
                difficulty = "medium",
                statement = "Given a string, return the length of its longest substring without repeated characters.",
                examples = listOf(PoolProblemExample("abcabcbb", "3", "abc")),
                constraints = listOf("1 <= n <= 100000"),
                starterPython = "def solve(s):\n    pass\n",
                starterJava = "class Solution { int solve(String s) { return 0; } }",
                stdinFormat = "One line: the string.",
                testCases = listOf(PoolProblemTestCase("abcabcbb", "3"), PoolProblemTestCase("bbbbb", "1")),
                testsVerified = testsVerified,
            ),
        )
}
