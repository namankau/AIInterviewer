package com.interviewos.api.pool

import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import java.time.Instant
import java.util.Locale
import java.util.UUID

// The question pool's own vocabulary (PRD §03, §04, §08). Task 039.
//
// Everything here mirrors a Postgres enum or table in
// `supabase/migrations/20260915000000_question_pool.sql`. The pool is model knowledge,
// held apart from the sourced bank on purpose, and never listed to a candidate: a round
// reaches for it when the bank has nothing for that company and round.

/** Mirrors the `role_family` Postgres enum. PRD wave-1 engineering families only. */
enum class RoleFamily(
    val dbValue: String,
    val label: String,
) {
    BACKEND("backend", "Backend engineering"),
    FULLSTACK_FRONTEND("fullstack_frontend", "Full-stack and frontend engineering"),
    MOBILE("mobile", "Mobile engineering"),
    QA_AUTOMATION("qa_automation", "QA and test automation"),
    DATA_ENGINEERING("data_engineering", "Data engineering"),
    ML_AI("ml_ai", "Machine learning and AI"),
    SRE("sre", "Site reliability and platform"),
    ;

    companion object {
        fun fromDbValue(value: String?): RoleFamily? = entries.firstOrNull { it.dbValue == value }

        /** Parses a value from a request or a database row, or fails with the value quoted. */
        fun require(value: String): RoleFamily =
            fromDbValue(value.trim().lowercase(Locale.ROOT))
                ?: throw IllegalArgumentException("'$value' is not a role family we generate for.")
    }
}

/** Mirrors the `experience_level` Postgres enum. */
enum class Level(
    val dbValue: String,
    val label: String,
) {
    ENTRY("entry", "Entry level"),
    MID("mid", "Mid level"),
    SENIOR("senior", "Senior"),
    STAFF("staff", "Staff and above"),
    ;

    companion object {
        fun fromDbValue(value: String?): Level? = entries.firstOrNull { it.dbValue == value }

        fun require(value: String): Level =
            fromDbValue(value.trim().lowercase(Locale.ROOT))
                ?: throw IllegalArgumentException("'$value' is not a level we generate for.")
    }
}

/**
 * What a pool question is allowed to claim about a named employer. Mirrors
 * `pool_association`.
 *
 * Neither value makes the question sourced. [COMPANY_SPECIFIC] means the model said, in a
 * separate call made first, that it knows this employer's process and could name
 * specifics — so the question may reflect them. [EMPLOYER_KIND] means what the candidate
 * is told talks about the kind of employer and never about the company. `PoolAssociationGate`
 * decides which, and it only ever decides downwards.
 */
enum class Association(
    val dbValue: String,
) {
    COMPANY_SPECIFIC("company_specific"),
    EMPLOYER_KIND("employer_kind"),
    ;

    companion object {
        fun fromDbValue(value: String?): Association = entries.firstOrNull { it.dbValue == value } ?: EMPLOYER_KIND
    }
}

/** Mirrors `pool_run_status`. `paused` is what the spend cap does, not a failure. */
enum class PoolRunStatus(
    val dbValue: String,
) {
    RUNNING("running"),
    PAUSED("paused"),
    FINISHED("finished"),
    FAILED("failed"),
    ;

    companion object {
        fun fromDbValue(value: String?): PoolRunStatus = entries.firstOrNull { it.dbValue == value } ?: FAILED
    }
}

/** Mirrors `pool_cell_status`. */
enum class PoolCellStatus(
    val dbValue: String,
) {
    PENDING("pending"),
    IN_PROGRESS("in_progress"),
    DONE("done"),
    SKIPPED("skipped"),
    FAILED("failed"),
    ;

    companion object {
        fun fromDbValue(value: String?): PoolCellStatus = entries.firstOrNull { it.dbValue == value } ?: PENDING
    }
}

/** Where in the pool a question sits: the coordinate a round looks up. */
data class PoolCoordinate(
    /** Null for a question written for the archetype rather than a named employer. */
    val companyId: UUID?,
    val archetype: Archetype,
    val roundType: RoundType,
    val roleFamily: RoleFamily,
    val level: Level,
)

/** A question about to be written to the pool. No id and no fingerprint: the database computes both. */
data class NewPoolQuestion(
    val coordinate: PoolCoordinate,
    val text: String,
    val followUps: List<String>,
    val strongAnswerCovers: List<String>,
    val association: Association,
    /** What the model said it knows about the employer. Required by the database when [association] is company-specific. */
    val knowledgeBasis: String?,
    val generatorVersion: Int,
    /** Which model actually wrote it — not which one was configured first. */
    val model: String,
    /** L2-normalised, [PoolProperties.embeddingDimensions] wide, or null when embeddings are unavailable. */
    val embedding: FloatArray? = null,
) {
    // Generated equality over a FloatArray compares references, which would make two
    // identical questions unequal and is never what a caller means. Nothing in the pool
    // compares these for equality, so the members are simply not generated.
    override fun equals(other: Any?): Boolean = this === other

    override fun hashCode(): Int = System.identityHashCode(this)
}

/** A question as it is stored. */
data class PoolQuestion(
    val id: UUID,
    val coordinate: PoolCoordinate,
    val text: String,
    val followUps: List<String>,
    val strongAnswerCovers: List<String>,
    val association: Association,
    val knowledgeBasis: String?,
    val generatorVersion: Int,
    val model: String,
    val fingerprint: String,
    val reviewedAt: Instant?,
    val retiredAt: Instant?,
)

/** One run of the generation job. */
data class PoolRun(
    val id: UUID,
    val startedAt: Instant,
    val finishedAt: Instant?,
    val status: PoolRunStatus,
    val generatorVersion: Int,
    val spendCapMicroUsd: Long,
    val spentMicroUsd: Long,
    val note: String?,
)

/** One unit of work: everything the job needs to fill a single coordinate. */
data class PoolCell(
    val id: UUID,
    val runId: UUID,
    val coordinate: PoolCoordinate,
    /** The employer's name, for the prompt. Null exactly when the coordinate has no company. */
    val companyName: String?,
    val status: PoolCellStatus,
    val attempts: Int,
)

/** What a cell cost and produced, as the job records it. */
data class PoolCellOutcome(
    val status: PoolCellStatus,
    val questionsWritten: Int,
    val duplicatesDropped: Int,
    val downgraded: Int,
    val error: String? = null,
)

/** What `GET /runs/{id}` answers with: the run, and how its cells are getting on. */
data class PoolRunProgress(
    val run: PoolRun,
    val cells: Map<PoolCellStatus, Int>,
    val questionsWritten: Int,
    val duplicatesDropped: Int,
) {
    val totalCells: Int get() = cells.values.sum()
}
