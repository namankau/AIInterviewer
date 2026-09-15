package com.interviewos.api.pool

import com.interviewos.api.ai.AiResult
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.EmployerKnowledge
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.ProblemExample
import com.interviewos.api.ai.ProblemTestCase
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.ProblemVerifier
import com.interviewos.api.interview.RoundType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

/**
 * The `coding_practical` pool generator.
 *
 * **No live model call**: [InterviewAi] and [ProblemVerifier] are both mocked at the
 * boundary (CLAUDE.md rule 7). `ProblemVerifier` itself already has its own execution-backed
 * tests (`ProblemVerifierTest`) against a stubbed sandbox; this suite only has to prove what
 * `CodingQuestionGenerator` does with the verdict it is handed.
 */
class CodingQuestionGeneratorTest {
    private val ai: InterviewAi = mock(InterviewAi::class.java)
    private val verifier: ProblemVerifier = mock(ProblemVerifier::class.java)
    private val mapper = JsonMapper.builder().build()
    private val generator = CodingQuestionGenerator(ai, verifier, mapper)

    private val cell =
        PoolCell(
            id = UUID.fromString("11111111-1111-1111-1111-111111111111"),
            runId = UUID.fromString("22222222-2222-2222-2222-222222222222"),
            coordinate =
                PoolCoordinate(
                    companyId = UUID.fromString("33333333-3333-3333-3333-333333333333"),
                    archetype = Archetype.GLOBAL_PRODUCT,
                    roundType = RoundType.CODING_PRACTICAL,
                    roleFamily = RoleFamily.BACKEND,
                    level = Level.MID,
                ),
            companyName = "Amazon",
            status = PoolCellStatus.IN_PROGRESS,
            attempts = 1,
        )

    private fun request(knowledge: EmployerKnowledge? = null) =
        PoolGenerationRequest(cell = cell, count = 6, avoid = listOf("An earlier sliding-window problem"), knowledge = knowledge)

    private fun problem(testsVerified: Boolean = true) =
        ComposedProblem(
            title = "Longest Balanced Window",
            topic = "sliding window",
            difficulty = "medium",
            statement = "Find the longest window whose max and min differ by at most K.",
            examples = listOf(ProblemExample("2 1 2 3", "2", "The window [1,2] has range 1.")),
            constraints = listOf("1 <= n <= 10^5"),
            starterPython = "print(0)",
            starterJava = "public class Main { public static void main(String[] a) {} }",
            stdinFormat = "K, then the values, space-separated.",
            testCases = listOf(ProblemTestCase("2 1 2 3", "2")),
            testsVerified = testsVerified,
        )

    private fun verified(problem: ComposedProblem = problem()) =
        ProblemVerifier.Verification(
            problem = problem,
            outcome = ProblemVerifier.Verification.Outcome.VERIFIED,
            corrected = 1,
            dropped = 0,
            reason = null,
        )

    private fun inconsistent() =
        ProblemVerifier.Verification(
            problem = problem(testsVerified = false),
            outcome = ProblemVerifier.Verification.Outcome.INCONSISTENT,
            corrected = 0,
            dropped = 0,
            reason = "the two solutions disagreed",
        )

    private fun unchecked() =
        ProblemVerifier.Verification(
            problem = problem(testsVerified = false),
            outcome = ProblemVerifier.Verification.Outcome.UNCHECKED,
            corrected = 0,
            dropped = 0,
            reason = "the sandbox could not be reached",
        )

    @Test
    fun `a verified problem is written with its payload and never claims company specificity`() {
        given(ai.composeProblem(anyArg(), anyInt())).willReturn(AiResult(problem(), AiUsage("gemini-3.1-flash-lite", 500, 500)))
        given(verifier.verify(anyArg())).willReturn(verified())

        // Even asked with an employer knowledge answer that would license the stronger
        // label for another round type, coding never claims it — see the class comment.
        val result = generator.generate(request(knowledge = EmployerKnowledge(knowsProcess = true, basis = "Their loop.")))

        assertThat(result.value.questions).hasSize(1)
        val question = result.value.questions.single()
        assertThat(question.text).isEqualTo("Find the longest window whose max and min differ by at most K.")
        assertThat(question.companySpecific).isFalse()
        assertThat(question.followUps).isNotEmpty()
        assertThat(question.strongAnswerCovers).isNotEmpty()

        val payload = question.payload
        assertThat(payload).isNotNull()
        assertThat(payload!!.path("kind").asText()).isEqualTo("coding_practical")
        assertThat(payload.path("testsVerified").asBoolean()).isTrue()
        assertThat(payload.path("testCases").isArray).isTrue()
        assertThat(payload.path("testCases")).hasSize(1)
        // Never persisted: see the class comment on why a solution is discarded once it
        // has done its job, the same discipline ComposedProblem uses before the browser.
        assertThat(payload.has("referencePython")).isFalse()
        assertThat(payload.has("bruteForcePython")).isFalse()

        verify(ai, times(1)).composeProblem(anyArg(), anyInt())
    }

    @Test
    fun `a problem whose two solutions disagree is retried once, and written if the retry verifies`() {
        given(ai.composeProblem(anyArg(), anyInt()))
            .willReturn(AiResult(problem(), AiUsage("gemini-3.1-flash-lite", 500, 500)))
        given(verifier.verify(anyArg()))
            .willReturn(inconsistent())
            .willReturn(verified())

        val result = generator.generate(request())

        assertThat(result.value.questions).hasSize(1)
        assertThat(
            result.value.questions
                .single()
                .payload
                ?.path("testsVerified")
                ?.asBoolean(),
        ).isTrue()
        verify(ai, times(2)).composeProblem(anyArg(), anyInt())
    }

    @Test
    fun `a problem that stays inconsistent after the retry is not written to the pool`() {
        given(ai.composeProblem(anyArg(), anyInt()))
            .willReturn(AiResult(problem(), AiUsage("gemini-3.1-flash-lite", 500, 500)))
        given(verifier.verify(anyArg())).willReturn(inconsistent())

        val result = generator.generate(request())

        assertThat(result.value.questions).isEmpty()
        verify(ai, times(2)).composeProblem(anyArg(), anyInt())
    }

    @Test
    fun `an unreachable sandbox is not retried and nothing is written`() {
        given(ai.composeProblem(anyArg(), anyInt()))
            .willReturn(AiResult(problem(), AiUsage("gemini-3.1-flash-lite", 500, 500)))
        given(verifier.verify(anyArg())).willReturn(unchecked())

        val result = generator.generate(request())

        assertThat(result.value.questions).isEmpty()
        // A second attempt cannot fix an unreachable sandbox, so it is not made.
        verify(ai, times(1)).composeProblem(anyArg(), anyInt())
    }

    @Test
    fun `the employer's name is never sent when the cell has no company`() {
        val archetypeCell = cell.copy(coordinate = cell.coordinate.copy(companyId = null), companyName = null)
        var capturedBrief: InterviewBrief? = null
        given(ai.composeProblem(anyArg(), anyInt())).willAnswer { invocation ->
            capturedBrief = invocation.getArgument(0)
            AiResult(problem(), AiUsage("gemini-3.1-flash-lite", 500, 500))
        }
        given(verifier.verify(anyArg())).willReturn(verified())

        generator.generate(PoolGenerationRequest(cell = archetypeCell, count = 6, avoid = emptyList(), knowledge = null))

        assertThat(capturedBrief?.company).doesNotContain("Amazon")
    }

    @Test
    fun `an unavailable AI provider fails the cell rather than silently producing nothing`() {
        given(ai.composeProblem(anyArg(), anyInt())).willThrow(AiUnavailableException("no key configured"))

        assertThrows<AiUnavailableException> { generator.generate(request()) }

        verify(verifier, never()).verify(anyArg())
    }
}
