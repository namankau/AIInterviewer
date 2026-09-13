package com.interviewos.api.interview

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.ComposedProblem
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.ProblemExample
import com.interviewos.api.ai.ProblemTestCase
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.security.MessageDigest

/**
 * Makes a coding problem's expected outputs true by running code, instead of trusting the
 * model's arithmetic.
 *
 * The model used to write `expected` by working each case out in its head, and it got
 * them wrong. Two rounds in a row, checked by running real solutions:
 *
 * - *Log Stream Batch Processor*, case 2: `K = 2` over `[1, 10, 2, 11, 3, 12, 4]`. No two
 *   neighbours are within 2 of each other, so the longest window is 1. The model said 2 —
 *   it had counted `[1, 2]`, which is not contiguous. The candidate's monotonic-deque
 *   solution was correct and the room told them it did not match.
 * - *Log Stream Partitioning*, worked example 1: the model said 3 and explained it by
 *   calling `[2, 5]` "length 3". The right answer is 2. A wrong worked example is worse
 *   than a wrong test case, because the candidate reads it first and builds their
 *   understanding of the problem on it.
 *
 * So the model now also writes two solutions — an efficient one and a brute force, in
 * the same program shape as the starter — and both are executed on every test input. A
 * case keeps the answer the two agree on; a case they disagree on is dropped. The worked
 * examples are then rebuilt from verified cases, so the problem text and the tests can
 * never disagree again.
 *
 * Execution happens in the model provider's sandbox ([InterviewAi.runPython]); there is
 * no free hosted runner left and the solutions must never reach the browser. The model
 * retypes the program to run it, so the program checks itself: it prints a hash of every
 * source it actually executed, and a report whose hashes are not ours is not believed.
 */
@Component
class ProblemVerifier(
    private val interviewAi: InterviewAi,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun verify(problem: ComposedProblem): Verification {
        val reference = problem.referencePython?.takeIf { it.isNotBlank() }
        val bruteForce = problem.bruteForcePython?.takeIf { it.isNotBlank() }
        if (reference == null || bruteForce == null || problem.testCases.isEmpty()) {
            return Verification.unchecked(problem, "the problem came without both solutions")
        }

        val programs =
            linkedMapOf(
                REFERENCE to reference,
                BRUTE_FORCE to bruteForce,
                STARTER to problem.starterPython,
            )
        val inputs = problem.testCases.map { it.input }

        val run =
            try {
                interviewAi.runPython(ProblemHarness.program(programs, inputs, objectMapper)).value
            } catch (e: AiUnavailableException) {
                log.warn("Could not run the solutions for '{}'; its tests stay unverified", problem.title, e)
                return Verification.unchecked(problem, "the sandbox could not be reached")
            }

        val report =
            ProblemHarness.parse(run.outputs, objectMapper)
                ?: return Verification.unchecked(problem, "the sandbox printed no report")
        if (!report.ran(programs, inputs)) {
            log.warn("The sandbox ran something other than what it was given for '{}'", problem.title)
            return Verification.unchecked(problem, "the sandbox did not run the programs as given")
        }

        return reconcile(problem, report).also { logOutcome(problem.title, it) }
    }

    /** Pure, so every rule about which answer wins is testable without a sandbox. */
    internal fun reconcile(
        problem: ComposedProblem,
        report: HarnessReport,
    ): Verification {
        val kept = mutableListOf<ProblemTestCase>()
        var corrected = 0
        problem.testCases.forEachIndexed { index, case ->
            val reference = report.outcome(REFERENCE, index)
            val bruteForce = report.outcome(BRUTE_FORCE, index)
            val claimed = normalise(case.expected)
            val answer = reference.stdout?.takeIf { it.isNotEmpty() } ?: return@forEachIndexed

            // Two independent programs printing the same thing is the evidence. A brute force
            // that ran out of time is no evidence either way, so the model's own figure
            // stands in as the second opinion — and only an exact match counts.
            val agreed = bruteForce.stdout == answer || (bruteForce.timedOut && claimed == answer)
            if (!agreed) return@forEachIndexed

            if (claimed != answer) corrected++
            kept += ProblemTestCase(input = case.input, expected = answer)
        }

        report.failures(STARTER).takeIf { it.isNotEmpty() }?.let {
            log.warn("The starter for '{}' crashes before it is touched, on cases {}", problem.title, it.map { i -> i + 1 })
        }

        if (kept.size < MIN_VERIFIED_CASES) {
            return Verification(
                problem = problem.copy(testsVerified = false),
                outcome = Verification.Outcome.INCONSISTENT,
                corrected = 0,
                dropped = 0,
                reason = "only ${kept.size} of ${problem.testCases.size} cases had two solutions agree",
            )
        }

        return Verification(
            problem =
                problem.copy(
                    testCases = kept,
                    examples = examplesFrom(kept, problem.examples),
                    testsVerified = true,
                ),
            outcome = Verification.Outcome.VERIFIED,
            corrected = corrected,
            dropped = problem.testCases.size - kept.size,
            reason = null,
        )
    }

    /**
     * The worked examples, rebuilt from cases that have been run.
     *
     * An explanation survives only when the model's own example agreed with the verified
     * answer. One that disagreed was reasoning its way to the wrong number — "the longest
     * is `[2, 5]`, length 3" — and showing it beside the corrected output would be worse
     * than showing no explanation at all.
     */
    private fun examplesFrom(
        cases: List<ProblemTestCase>,
        claimed: List<ProblemExample>,
    ): List<ProblemExample> =
        cases.take(EXAMPLES_SHOWN).map { case ->
            val match = claimed.firstOrNull { collapse(it.input) == collapse(case.input) }
            val explanation = match?.explanation?.takeIf { normalise(match.output) == case.expected }
            ProblemExample(input = case.input, output = case.expected, explanation = explanation)
        }

    private fun logOutcome(
        title: String,
        verification: Verification,
    ) {
        when (verification.outcome) {
            Verification.Outcome.VERIFIED -> {
                log.info(
                    "Tests for '{}' verified by execution: {} kept, {} corrected from the model's own answer, {} dropped",
                    title,
                    verification.problem.testCases.size,
                    verification.corrected,
                    verification.dropped,
                )
            }

            else -> {
                log.warn("Tests for '{}' not verified: {}", title, verification.reason)
            }
        }
    }

    /**
     * The result of checking one problem.
     *
     * [problem] is always usable: when nothing could be checked it is the model's problem
     * as it was, marked unverified so the room can say so rather than implying otherwise.
     */
    data class Verification(
        val problem: ComposedProblem,
        val outcome: Outcome,
        val corrected: Int,
        val dropped: Int,
        val reason: String?,
    ) {
        enum class Outcome {
            /** At least [MIN_VERIFIED_CASES] cases agreed between two solutions. */
            VERIFIED,

            /** The programs ran, but the model's two solutions disagree. Composing again may help. */
            INCONSISTENT,

            /** Nothing could be run. Composing again would not help — the sandbox is the problem. */
            UNCHECKED,
        }

        companion object {
            fun unchecked(
                problem: ComposedProblem,
                reason: String,
            ) = Verification(problem.copy(testsVerified = false), Outcome.UNCHECKED, 0, 0, reason)
        }
    }

    companion object {
        const val REFERENCE = "reference"
        const val BRUTE_FORCE = "bruteForce"
        const val STARTER = "starter"

        /** Fewer agreed cases than this and the problem's own understanding is in doubt. */
        const val MIN_VERIFIED_CASES = 2

        /** Two worked examples, as the prompt asks for and the problem panel lays out. */
        private const val EXAMPLES_SHOWN = 2

        /**
         * How two outputs are compared: line endings and trailing spaces do not count,
         * anything else does. The browser's comparison is the same rule.
         */
        fun normalise(output: String): String =
            output
                .replace("\r\n", "\n")
                .lines()
                .joinToString("\n") { it.trimEnd() }
                .trim()

        private fun collapse(input: String): String = input.trim().split(Regex("\\s+")).joinToString(" ")
    }
}

/**
 * The Python program that runs a problem's solutions against its cases, and the report it
 * prints.
 *
 * Every program is run in-process with its own stdin and stdout, a fresh `__main__`
 * namespace, and a two-second alarm per case — the sandbox allows thirty seconds in all,
 * and one runaway brute force must not cost the whole check.
 */
object ProblemHarness {
    private const val SENTINEL = "<<<ACEMY-REPORT>>>"

    /** Output past this is a program printing in a loop; the case is judged on what came first. */
    private const val MAX_STDOUT_CHARS = 4_000

    fun program(
        programs: Map<String, String>,
        cases: List<String>,
        objectMapper: ObjectMapper,
    ): String {
        val literal = { text: String -> pythonLiteral(text, objectMapper) }
        return buildString {
            appendLine("import hashlib, io, json, signal, sys, traceback")
            appendLine()
            appendLine("PROGRAMS = {")
            programs.forEach { (name, source) -> appendLine("    ${objectMapper.writeValueAsString(name)}: ${literal(source)},") }
            appendLine("}")
            appendLine("CASES = json.loads(${literal(objectMapper.writeValueAsString(cases))})")
            append(
                """

                def _alarm(signum, frame):
                    raise TimeoutError('case took too long')

                def run(source, stdin):
                    captured = io.StringIO()
                    saved = sys.stdin, sys.stdout
                    sys.stdin = io.TextIOWrapper(io.BytesIO(stdin.encode()), encoding='utf-8')
                    sys.stdout = captured
                    try:
                        signal.signal(signal.SIGALRM, _alarm)
                        signal.alarm(2)
                    except Exception:
                        pass
                    try:
                        exec(compile(source, '<program>', 'exec'), {'__name__': '__main__'})
                        return {'ok': True, 'stdout': captured.getvalue()[:$MAX_STDOUT_CHARS]}
                    except SystemExit as exit_:
                        return {'ok': exit_.code in (None, 0), 'stdout': captured.getvalue()[:$MAX_STDOUT_CHARS]}
                    except TimeoutError:
                        return {'ok': False, 'timedOut': True, 'stdout': ''}
                    except BaseException:
                        return {'ok': False, 'stdout': '', 'error': traceback.format_exc(limit=2)[-400:]}
                    finally:
                        try:
                            signal.alarm(0)
                        except Exception:
                            pass
                        sys.stdin, sys.stdout = saved

                report = {
                    'hashes': {name: hashlib.sha256(src.encode()).hexdigest() for name, src in PROGRAMS.items()},
                    'cases': [hashlib.sha256(case.encode()).hexdigest() for case in CASES],
                    'runs': {name: [run(src, case) for case in CASES] for name, src in PROGRAMS.items()},
                }
                print('$SENTINEL' + json.dumps(report) + '$SENTINEL')
                """.trimIndent(),
            )
            appendLine()
        }
    }

    /** The report from whichever execution printed one, or null if none did. */
    fun parse(
        outputs: List<String>,
        objectMapper: ObjectMapper,
    ): HarnessReport? {
        val pattern = Regex(Regex.escape(SENTINEL) + "(.*)" + Regex.escape(SENTINEL), RegexOption.DOT_MATCHES_ALL)
        val json = outputs.asReversed().firstNotNullOfOrNull { pattern.find(it)?.groupValues?.get(1) } ?: return null
        return runCatching { HarnessReport(objectMapper.readTree(json)) }.getOrNull()
    }

    fun sha256(text: String): String =
        MessageDigest
            .getInstance("SHA-256")
            .digest(text.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    /**
     * A Python string literal holding [text] exactly.
     *
     * Raw triple quotes wherever possible, because the model copies natural multi-line
     * code far more faithfully than one long escaped line. JSON string syntax — valid
     * Python — for the text a raw literal cannot hold. Anything that still slips through
     * changes what Python sees, which changes its hash, which [HarnessReport.ran] refuses.
     */
    private fun pythonLiteral(
        text: String,
        objectMapper: ObjectMapper,
    ): String =
        if ("'''" in text || text.endsWith("\\") || text.endsWith("'") || '\r' in text) {
            objectMapper.writeValueAsString(text)
        } else {
            "r'''$text'''"
        }
}

/** What the harness printed, read defensively: it came back through a model. */
class HarnessReport(
    private val root: JsonNode,
) {
    data class CaseOutcome(
        /** Normalised stdout, or null when the program failed on this case. */
        val stdout: String?,
        val timedOut: Boolean,
    )

    fun outcome(
        program: String,
        index: Int,
    ): CaseOutcome {
        val run = root.path("runs").path(program).path(index)
        val ok = run.path("ok").asBoolean(false)
        return CaseOutcome(
            stdout = if (ok) ProblemVerifier.normalise(run.path("stdout").asString("")) else null,
            timedOut = run.path("timedOut").asBoolean(false),
        )
    }

    /** The case indexes [program] failed on. */
    fun failures(program: String): List<Int> =
        root
            .path("runs")
            .path(program)
            .mapIndexedNotNull { index, run -> index.takeUnless { run.path("ok").asBoolean(false) } }

    /** True when the sandbox ran exactly these programs on exactly these inputs. */
    fun ran(
        programs: Map<String, String>,
        cases: List<String>,
    ): Boolean {
        val hashes = root.path("hashes")
        // By index: Jackson 3's JsonNode has a `map` of its own, which shadows the list one.
        val caseHashes = root.path("cases").let { node -> (0 until node.size()).map { node.path(it).asString("") } }
        return programs.all { (name, source) -> hashes.path(name).asString("") == ProblemHarness.sha256(source) } &&
            caseHashes == cases.map(ProblemHarness::sha256)
    }
}
