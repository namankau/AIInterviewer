package com.interviewos.api.pool

// The round-type-specific payload written to `pool_questions.payload` (task 040). See
// `supabase/migrations/20260915010000_pool_coding_payload.sql` for the column and the same
// shapes documented for a reader without Kotlin in hand.
//
// Every other pool column (`text`, `follow_ups`, `strong_answer_covers`, `association`, ...)
// is shared across every round type. These two classes hold the detail that is not: a
// verified coding problem's tests and starters, and a design case's constraints and deep
// dives. A generator for a round type with nothing beyond the shared columns simply writes
// no payload — see `HrFitQuestionGenerator` (task 039), which still writes null.

/** One worked example, mirroring `ai.ProblemExample` without depending on the `ai` package's shape. */
data class PoolProblemExample(
    val input: String,
    val output: String,
    val explanation: String?,
)

/** One verified test case: an input and the output two independent solutions agreed on. */
data class PoolProblemTestCase(
    val input: String,
    val expected: String,
)

/**
 * What a `coding_practical` pool question carries beyond its text.
 *
 * Built from a [com.interviewos.api.ai.ComposedProblem] that [com.interviewos.api.interview.ProblemVerifier]
 * has verified — [testsVerified] is always true on a stored row, because
 * [CodingQuestionGenerator] never writes one that is not. Deliberately holds no reference or
 * brute-force solution: those exist only to check [testCases] and are discarded once that is
 * done, the same discipline [com.interviewos.api.ai.ComposedProblem] itself uses before a
 * problem reaches a candidate's browser — a solution kept anywhere a bug could serve it to a
 * client is a solution handed over.
 */
data class CodingPoolPayload(
    val kind: String = KIND,
    val topic: String,
    val difficulty: String,
    val statement: String,
    val examples: List<PoolProblemExample>,
    val constraints: List<String>,
    val starterPython: String,
    val starterJava: String,
    val stdinFormat: String,
    val testCases: List<PoolProblemTestCase>,
    val testsVerified: Boolean,
) {
    companion object {
        const val KIND = "coding_practical"
    }
}

/**
 * What LLD / machine-coding and large-scale distributed design have in common: a system
 * design round, tagged with which flavour it is.
 *
 * Kept inside the payload rather than as a new column or a second `round_type` value,
 * because it is detail about one `system_design` question, not a different kind of thing —
 * exactly the reasoning `pool_questions.payload` exists under. A new enum column would also
 * have to be nullable for every other round type, for a distinction only this one draws.
 */
enum class DesignTag(
    val dbValue: String,
) {
    /** A single component or data structure designed and reasoned about in isolation: a cache, a rate limiter, a scheduler. */
    MACHINE_CODING("machine_coding"),

    /** A networked system at scale: multiple services, a data store, a failure mode that crosses a process boundary. */
    DISTRIBUTED_DESIGN("distributed_design"),
    ;

    companion object {
        fun fromDbValue(value: String?): DesignTag? = entries.firstOrNull { it.dbValue == value }
    }
}

/**
 * What a `system_design` pool question carries beyond its text.
 *
 * [text] on the row itself is the opening prompt — the one thing said aloud to start, as
 * [com.interviewos.api.ai.ComposedCase.openingPrompt] is. Follow-ups live in the shared
 * `follow_ups` column, built from [com.interviewos.api.ai.ComposedCase.deepDiveOptions] — a
 * design case already gets 2-3 areas worth pushing on from the same call, so nothing extra
 * needs asking for them. [weakAnswerMisses] does not: no existing field says what a weak
 * answer leaves out, so [SystemDesignQuestionGenerator] writes it itself.
 */
data class SystemDesignPoolPayload(
    val kind: String = KIND,
    val designTag: String,
    val title: String,
    val summary: String,
    val constraints: List<String>,
    val weakAnswerMisses: List<String>,
) {
    companion object {
        const val KIND = "system_design"
    }
}
