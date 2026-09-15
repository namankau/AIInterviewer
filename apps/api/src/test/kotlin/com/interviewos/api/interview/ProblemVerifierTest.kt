package com.interviewos.api.interview

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.ProblemExample
import com.interviewos.api.ai.ProblemTestCase
import com.interviewos.api.ai.SandboxRun
import com.interviewos.api.interview.ProblemVerifier.Verification.Outcome
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verifyNoInteractions
import tools.jackson.databind.json.JsonMapper
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The expected outputs a candidate's code is compared against come from running two
 * solutions, not from the model's arithmetic.
 *
 * The first two fixtures are the problems from real rounds where the model's own figure was
 * wrong and the room told a candidate their code did not match. The sandbox is mocked at
 * the boundary; the report it returns is shaped exactly as the harness prints it.
 */
class ProblemVerifierTest {
    private val mapper = JsonMapper.builder().build()
    private val ai: InterviewAi = mock(InterviewAi::class.java)
    private val verifier = ProblemVerifier(ai, mapper)

    private val reference = "import sys\nprint('reference')\n"
    private val bruteForce = "import sys\nprint('brute force')\n"
    private val starter = "import sys\nprint(0)\n"

    /** From a real round: `K = 2` over `[1, 10, 2, 11, 3, 12, 4]` has no window longer than 1. */
    private val batchProcessor =
        problem(
            "2 2 1 3 5 7 8 9 2" to "3",
            "2 1 10 2 11 3 12 4" to "2",
            "5 10 10 10" to "3",
            "10 5" to "1",
        )

    @Test
    fun `a wrong expected output is replaced by the answer two solutions agree on`() {
        sandboxPrints(batchProcessor, reference = listOf("3", "1", "3", "1"), bruteForce = listOf("3", "1", "3", "1"))

        val verification = verifier.verify(batchProcessor)

        assertEquals(Outcome.VERIFIED, verification.outcome)
        assertTrue(verification.problem.testsVerified)
        assertEquals(listOf("3", "1", "3", "1"), verification.problem.testCases.map { it.expected })
        assertEquals(1, verification.corrected, "the model said 2 for the second case")
    }

    /**
     * From a real round: the model said the longest window in `[1, 2, 5, 8, 10]` within 3
     * was 3, "`[2, 5]`, length 3". It is 2. The candidate read that first, and built their
     * solution on it.
     */
    @Test
    fun `a worked example that was wrong is corrected and loses the explanation that argued for it`() {
        val partitioning =
            problem(
                "1 2 5 8 10\n3" to "3",
                "1 10 20\n5" to "1",
                "5 5 5 5\n0" to "4",
                "100\n10" to "1",
                examples =
                    listOf(
                        ProblemExample("1 2 5 8 10\n3", "3", "The longest is [2, 5] or [5, 8], both length 3."),
                        ProblemExample("1 10 20\n5", "1", "No two logs are within 5 of each other."),
                    ),
            )
        sandboxPrints(partitioning, reference = listOf("2", "1", "4", "1"), bruteForce = listOf("2", "1", "4", "1"))

        val examples = verifier.verify(partitioning).problem.examples

        assertEquals("2", examples[0].output)
        assertNull(examples[0].explanation, "an explanation reasoning to the wrong number is worse than none")
        assertEquals("1", examples[1].output)
        assertEquals("No two logs are within 5 of each other.", examples[1].explanation)
    }

    @Test
    fun `the worked examples are the first verified cases, so the problem and the tests cannot disagree`() {
        sandboxPrints(batchProcessor, reference = listOf("3", "1", "3", "1"), bruteForce = listOf("3", "1", "3", "1"))

        val verified = verifier.verify(batchProcessor).problem

        assertEquals(verified.testCases.take(2).map { it.input }, verified.examples.map { it.input })
        assertEquals(verified.testCases.take(2).map { it.expected }, verified.examples.map { it.output })
    }

    @Test
    fun `a case the two solutions disagree on is dropped rather than guessed`() {
        sandboxPrints(batchProcessor, reference = listOf("3", "1", "3", "1"), bruteForce = listOf("3", "2", "3", "1"))

        val verification = verifier.verify(batchProcessor)

        assertEquals(Outcome.VERIFIED, verification.outcome)
        assertEquals(
            listOf("5 10 10 10", "10 5"),
            verification.problem.testCases
                .drop(1)
                .map { it.input },
        )
        assertEquals(1, verification.dropped)
    }

    @Test
    fun `a brute force that ran out of time counts only where the model's own answer matches`() {
        sandboxPrints(
            batchProcessor,
            reference = listOf("3", "1", "3", "1"),
            bruteForce = listOf("3", null, null, "1"),
            timedOut = setOf(1, 2),
        )

        val cases = verifier.verify(batchProcessor).problem.testCases

        // Case 2: the model said 2, the reference says 1, and there is no third opinion.
        assertEquals(listOf("2 2 1 3 5 7 8 9 2", "5 10 10 10", "10 5"), cases.map { it.input })
    }

    @Test
    fun `solutions that mostly disagree leave the problem unverified and say so`() {
        sandboxPrints(batchProcessor, reference = listOf("1", "2", "3", "1"), bruteForce = listOf("9", "9", "9", "1"))

        val verification = verifier.verify(batchProcessor)

        assertEquals(Outcome.INCONSISTENT, verification.outcome)
        assertFalse(verification.problem.testsVerified)
        assertEquals(batchProcessor.testCases, verification.problem.testCases)
    }

    @Test
    fun `a report from programs other than the ones sent is not believed`() {
        sandboxPrints(
            batchProcessor,
            reference = listOf("3", "1", "3", "1"),
            bruteForce = listOf("3", "1", "3", "1"),
            ranReference = "import sys\nprint('something the model rewrote')\n",
        )

        val verification = verifier.verify(batchProcessor)

        assertEquals(Outcome.UNCHECKED, verification.outcome)
        assertFalse(verification.problem.testsVerified)
        assertEquals(batchProcessor.testCases, verification.problem.testCases)
    }

    @Test
    fun `an unreachable sandbox leaves the problem as written, marked unverified`() {
        given(ai.runPython(anyString())).willThrow(AiUnavailableException("sandbox down"))

        val verification = verifier.verify(batchProcessor)

        assertEquals(Outcome.UNCHECKED, verification.outcome)
        assertFalse(verification.problem.testsVerified)
    }

    @Test
    fun `a problem without both solutions is never sent to the sandbox`() {
        val verification = verifier.verify(batchProcessor.copy(bruteForcePython = null))

        assertEquals(Outcome.UNCHECKED, verification.outcome)
        verifyNoInteractions(ai)
    }

    @Test
    fun `the report is found among whatever else the sandbox printed`() {
        val found = ProblemHarness.parse(listOf("Traceback: first try failed", "<<<ACEMY-REPORT>>>{\"runs\":{}}<<<ACEMY-REPORT>>>"), mapper)

        assertNotNull(found)
        assertNull(ProblemHarness.parse(listOf("DONE"), mapper))
    }

    @Test
    fun `outputs compare equal across line endings and trailing spaces, and on nothing looser`() {
        assertEquals(ProblemVerifier.normalise("[1, 2]\r\n3  \n"), ProblemVerifier.normalise("[1, 2]\n3"))
        assertFalse(ProblemVerifier.normalise("[1,2]") == ProblemVerifier.normalise("[1, 2]"))
    }

    private fun problem(
        vararg cases: Pair<String, String>,
        examples: List<ProblemExample> = cases.take(2).map { ProblemExample(it.first, it.second, "Worked through.") },
    ) = ComposedProblem(
        title = "Log Stream Batch Processor",
        topic = "sliding window",
        difficulty = "medium",
        statement = "Find the longest contiguous window whose max and min differ by at most K.",
        examples = examples,
        constraints = listOf("1 <= n <= 10^5"),
        starterPython = starter,
        starterJava = "public class Main { public static void main(String[] a) {} }",
        stdinFormat = "K, then the timestamps, space-separated.",
        testCases = cases.map { ProblemTestCase(it.first, it.second) },
        referencePython = reference,
        bruteForcePython = bruteForce,
    )

    /** Stubs the sandbox to print the harness report for these outputs, hashed as Python would. */
    private fun sandboxPrints(
        problem: ComposedProblem,
        reference: List<String?>,
        bruteForce: List<String?>,
        timedOut: Set<Int> = emptySet(),
        ranReference: String = this.reference,
    ) {
        fun runs(outputs: List<String?>) =
            outputs.mapIndexed { index, out ->
                when {
                    out != null -> mapOf("ok" to true, "stdout" to "$out\n")
                    index in timedOut -> mapOf("ok" to false, "timedOut" to true, "stdout" to "")
                    else -> mapOf("ok" to false, "stdout" to "", "error" to "Traceback")
                }
            }
        val report =
            mapOf(
                "hashes" to
                    mapOf(
                        ProblemVerifier.REFERENCE to ProblemHarness.sha256(ranReference),
                        ProblemVerifier.BRUTE_FORCE to ProblemHarness.sha256(this.bruteForce),
                        ProblemVerifier.STARTER to ProblemHarness.sha256(starter),
                    ),
                "cases" to problem.testCases.map { ProblemHarness.sha256(it.input) },
                "runs" to
                    mapOf(
                        ProblemVerifier.REFERENCE to runs(reference),
                        ProblemVerifier.BRUTE_FORCE to runs(bruteForce),
                        ProblemVerifier.STARTER to runs(reference.map { "0" }),
                    ),
            )
        val printed = "<<<ACEMY-REPORT>>>" + mapper.writeValueAsString(report) + "<<<ACEMY-REPORT>>>\n"
        given(ai.runPython(anyString())).willReturn(
            AiResult(SandboxRun(listOf(printed)), AiUsage(model = "gemini-3.1-flash-lite", promptTokens = 3_000, outputTokens = 1_000)),
        )
    }
}
