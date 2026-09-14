package com.interviewos.api.interview

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.ProblemExample
import com.interviewos.api.ai.ProblemTestCase
import com.interviewos.api.ai.SandboxRun
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import tools.jackson.databind.json.JsonMapper
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * What the DSA room is handed: a problem whose tests were checked, and never the
 * solutions used to check them.
 */
class RoundWorkspaceComposerTest {
    private val mapper = JsonMapper.builder().build()
    private val ai: InterviewAi = mock(InterviewAi::class.java)
    private val composer = RoundWorkspaceComposer(ai, mapper, ProblemVerifier(ai, mapper))

    private val brief =
        InterviewBrief(
            company = "Amazon",
            archetype = "product_company",
            role = "SDE 2",
            roundType = "Coding",
            roundCovers = "- problem solving",
            language = "english",
            candidateFunction = null,
            candidateLevel = null,
            targetLevel = null,
            grounding = "Archetype-level patterns only.",
        )

    private val secretReference = "import sys\n# THE REFERENCE SOLUTION\nprint(1)\n"
    private val secretBruteForce = "import sys\n# THE BRUTE FORCE\nprint(1)\n"

    @Test
    fun `the problem the browser is sent carries no solution`() {
        val problem = problem("Burst Window")
        given(ai.composeProblem(brief, 5)).willReturn(result(problem))
        givenSandboxAgrees(problem)

        val workspace = assertNotNull(composer.compose(brief, RoundType.CODING_PRACTICAL, 5))

        assertFalse(workspace.json.contains("THE REFERENCE SOLUTION"), "a solution in the page source is a solution handed over")
        assertFalse(workspace.json.contains("THE BRUTE FORCE"))
        assertTrue(
            mapper
                .readTree(workspace.json)
                .path("problem")
                .path("testsVerified")
                .asBoolean(false),
        )
    }

    @Test
    fun `a problem whose two solutions disagree is composed once more`() {
        val muddled = problem("Muddled Problem")
        val clear = problem("Clear Problem")
        given(ai.composeProblem(brief, 5)).willReturn(result(muddled), result(clear))
        given(ai.runPython(anyString())).willReturn(
            sandbox(muddled, reference = listOf("1", "2", "3"), bruteForce = listOf("7", "8", "9")),
            sandbox(clear, reference = listOf("1", "1", "1"), bruteForce = listOf("1", "1", "1")),
        )

        val workspace = assertNotNull(composer.compose(brief, RoundType.CODING_PRACTICAL, 5))

        verify(ai, times(2)).composeProblem(brief, 5)
        val stored = mapper.readTree(workspace.json).path("problem")
        assertEquals("Clear Problem", stored.path("title").asString(""))
        assertTrue(stored.path("testsVerified").asBoolean(false))
    }

    private val twoSum =
        BankFixtures.question(
            "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
            roundType = RoundType.CODING_PRACTICAL,
        )
    private val seededBrief =
        brief.copy(
            plannedQuestion =
                com.interviewos.api.ai
                    .PlannedQuestion(twoSum.text, "Amazon", askNow = true),
        )

    @Test
    fun `a seeded problem is composed as the bank question and carries it`() {
        val problem =
            problem(
                "Two Sum",
                statement = "Given an array of integers and a target, return the indices of the two numbers that add up to it.",
            )
        given(ai.composeProblem(seededBrief, 5)).willReturn(result(problem))
        givenSandboxAgrees(problem)

        val workspace = assertNotNull(composer.compose(brief, RoundType.CODING_PRACTICAL, 5, seed = twoSum))

        assertEquals(twoSum, workspace.bankQuestion)
        assertEquals(twoSum.id.toString(), mapper.readTree(workspace.json).path("bankQuestionId").asString())
        assertTrue(workspace.basis.contains("reported for Amazon"))
    }

    @Test
    fun `a seeded problem that came back as a different problem is kept but not labelled as reported`() {
        val problem = problem("Burst Window", statement = "Count the longest run of equal characters in a string.")
        given(ai.composeProblem(seededBrief, 5)).willReturn(result(problem))
        givenSandboxAgrees(problem)

        val workspace = assertNotNull(composer.compose(brief, RoundType.CODING_PRACTICAL, 5, seed = twoSum))

        assertEquals(null, workspace.bankQuestion)
        assertFalse(mapper.readTree(workspace.json).path("bankQuestionId").isString)
        assertFalse(workspace.basis.contains("reported"))
    }

    private fun problem(
        title: String,
        statement: String = "Count something.",
    ) = ComposedProblem(
        title = title,
        topic = "sliding window",
        difficulty = "easy",
        statement = statement,
        examples = listOf(ProblemExample("1", "1"), ProblemExample("2", "1")),
        constraints = emptyList(),
        starterPython = "import sys\nprint(0)\n",
        starterJava = "public class Main { public static void main(String[] a) {} }",
        stdinFormat = "One integer.",
        testCases = listOf(ProblemTestCase("1", "1"), ProblemTestCase("2", "1"), ProblemTestCase("3", "1")),
        referencePython = secretReference,
        bruteForcePython = secretBruteForce,
    )

    private fun result(problem: ComposedProblem) = AiResult(problem, AiUsage("gemini-3.1-flash-lite", 2_000, 1_500))

    private fun givenSandboxAgrees(problem: ComposedProblem) {
        given(ai.runPython(anyString())).willReturn(sandbox(problem, listOf("1", "1", "1"), listOf("1", "1", "1")))
    }

    private fun sandbox(
        problem: ComposedProblem,
        reference: List<String>,
        bruteForce: List<String>,
    ): AiResult<SandboxRun> {
        val report =
            mapOf(
                "hashes" to
                    mapOf(
                        ProblemVerifier.REFERENCE to ProblemHarness.sha256(secretReference),
                        ProblemVerifier.BRUTE_FORCE to ProblemHarness.sha256(secretBruteForce),
                        ProblemVerifier.STARTER to ProblemHarness.sha256(problem.starterPython),
                    ),
                "cases" to problem.testCases.map { ProblemHarness.sha256(it.input) },
                "runs" to
                    mapOf(
                        ProblemVerifier.REFERENCE to reference.map { mapOf("ok" to true, "stdout" to it) },
                        ProblemVerifier.BRUTE_FORCE to bruteForce.map { mapOf("ok" to true, "stdout" to it) },
                        ProblemVerifier.STARTER to reference.map { mapOf("ok" to true, "stdout" to "0") },
                    ),
            )
        val printed = "<<<ACEMY-REPORT>>>" + mapper.writeValueAsString(report) + "<<<ACEMY-REPORT>>>"
        return AiResult(SandboxRun(listOf(printed)), AiUsage("gemini-3.1-flash-lite", 3_000, 1_000))
    }
}
