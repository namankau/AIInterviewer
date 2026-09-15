package com.interviewos.api.pool

import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.util.UUID

/**
 * The generation job's bookkeeping: runs, the cells they are made of, and what they spent.
 *
 * The cell table is the only reason the job is resumable. A run's work is written down
 * before any of it is attempted, each cell is claimed and marked as it goes, and a process
 * that dies — from a usage limit, a deploy, a crash — leaves behind a truthful record of
 * exactly which coordinates still need doing. Resuming is then nothing more than asking for
 * pending cells again, and it costs nothing that was already paid for.
 */
@Repository
class PoolRunRepository(
    private val jdbcClient: JdbcClient,
) {
    fun createRun(
        generatorVersion: Int,
        spendCapMicroUsd: Long,
        note: String?,
    ): PoolRun =
        jdbcClient
            .sql(
                """
                insert into public.pool_generation_runs (status, generator_version, spend_cap_micro_usd, note)
                values (cast(:status as public.pool_run_status), :version, :cap, :note)
                returning $RUN_COLUMNS
                """.trimIndent(),
            ).param("status", PoolRunStatus.PAUSED.dbValue)
            .param("version", generatorVersion)
            .param("cap", spendCapMicroUsd)
            .param("note", note)
            .query { rs, _ -> mapRun(rs) }
            .single()

    fun findRun(id: UUID): PoolRun? =
        jdbcClient
            .sql("select $RUN_COLUMNS from public.pool_generation_runs where id = :id")
            .param("id", id)
            .query { rs, _ -> mapRun(rs) }
            .optional()
            .orElse(null)

    /**
     * Moves a run to [status], stamping `finished_at` for the statuses that end it.
     *
     * `REQUIRES_NEW` for the same reason the spend ledger uses it: this is most often
     * called to record that something went wrong, and a status that rolls back with the
     * failure it was describing leaves a run marked `running` for ever, which is exactly
     * the state a resume cannot reason about.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun updateStatus(
        id: UUID,
        status: PoolRunStatus,
        note: String? = null,
    ) {
        jdbcClient
            .sql(
                """
                update public.pool_generation_runs
                   set status = cast(:status as public.pool_run_status),
                       finished_at = case when :ended then now() else finished_at end,
                       note = coalesce(:note, note)
                 where id = :id
                """.trimIndent(),
            ).param("status", status.dbValue)
            .param("ended", status == PoolRunStatus.FINISHED || status == PoolRunStatus.FAILED)
            .param("note", note)
            .param("id", id)
            .update()
    }

    /** Caches the run's spend so the status endpoint is one read. The ledger stays the truth. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordSpend(
        id: UUID,
        spentMicroUsd: Long,
    ) {
        jdbcClient
            .sql("update public.pool_generation_runs set spent_micro_usd = :spent where id = :id")
            .param("spent", spentMicroUsd)
            .param("id", id)
            .update()
    }

    /**
     * What this run has actually spent, from `ai_calls`.
     *
     * Read from the ledger rather than from a counter the job keeps, because the job's
     * counter would not survive the job dying — and a resumed run that forgot the first
     * three dollars would cheerfully spend the cap again.
     */
    fun spentOn(runId: UUID): Long =
        jdbcClient
            .sql("select coalesce(sum(micro_usd), 0) from public.ai_calls where pool_run_id = :run")
            .param("run", runId)
            .query(Long::class.java)
            .single()

    /**
     * Writes the run's work down before any of it is attempted.
     *
     * Idempotent on the coordinate, so planning the same run twice — a retried request, a
     * resume that adds a company — adds what is missing and touches nothing that exists.
     *
     * @return how many cells were newly created
     */
    @Transactional
    fun planCells(
        runId: UUID,
        cells: List<PlannedCell>,
    ): Int {
        var created = 0
        cells.forEach { cell ->
            created +=
                jdbcClient
                    .sql(
                        """
                        insert into public.pool_generation_cells
                               (run_id, company_id, archetype, round_type, role_family, level)
                        values (:run, :company, cast(:archetype as public.employer_archetype),
                                cast(:round as public.round_type), cast(:role as public.role_family),
                                cast(:level as public.experience_level))
                        on conflict do nothing
                        """.trimIndent(),
                    ).param("run", runId)
                    .param("company", cell.coordinate.companyId)
                    .param("archetype", cell.coordinate.archetype.dbValue)
                    .param("round", cell.coordinate.roundType.dbValue)
                    .param("role", cell.coordinate.roleFamily.dbValue)
                    .param("level", cell.coordinate.level.dbValue)
                    .update()
        }
        return created
    }

    /**
     * Claims the next cell for this worker, or null when there are none left.
     *
     * `for update skip locked` is what makes the configured concurrency safe: two workers
     * asking at the same moment get two different cells rather than both getting the first
     * one and generating it twice. The claim and the status change are the same statement,
     * so there is no window in which a cell is chosen but not yet marked.
     *
     * A cell that has already been attempted [maxAttempts] times is not offered again. A
     * cell failing twice is failing for a reason, and a third call is money spent on the
     * same error.
     */
    @Transactional
    fun claimNextCell(
        runId: UUID,
        maxAttempts: Int,
    ): PoolCell? =
        jdbcClient
            .sql(
                """
                update public.pool_generation_cells cell
                   set status = cast('in_progress' as public.pool_cell_status),
                       attempts = cell.attempts + 1,
                       started_at = coalesce(cell.started_at, now()),
                       updated_at = now()
                  from (
                        select c.id
                          from public.pool_generation_cells c
                         where c.run_id = :run
                           and c.status = cast('pending' as public.pool_cell_status)
                           and c.attempts < :maxAttempts
                         order by c.created_at, c.id
                         limit 1
                           for update skip locked
                       ) next
                 where cell.id = next.id
                returning $CELL_COLUMNS,
                          (select name from public.companies where id = cell.company_id) as company_name
                """.trimIndent(),
            ).param("run", runId)
            .param("maxAttempts", maxAttempts)
            .query { rs, _ -> mapCell(rs) }
            .optional()
            .orElse(null)

    /** Records how a cell turned out. A failed cell goes back to pending so a resume retries it. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun completeCell(
        cellId: UUID,
        outcome: PoolCellOutcome,
    ) {
        jdbcClient
            .sql(
                """
                update public.pool_generation_cells
                   set status = cast(:status as public.pool_cell_status),
                       questions_written = questions_written + :written,
                       duplicates_dropped = duplicates_dropped + :dropped,
                       error = :error,
                       finished_at = case when :ended then now() else null end,
                       updated_at = now()
                 where id = :id
                """.trimIndent(),
            ).param("status", outcome.status.dbValue)
            .param("written", outcome.questionsWritten)
            .param("dropped", outcome.duplicatesDropped)
            .param("error", outcome.error)
            .param("ended", outcome.status != PoolCellStatus.PENDING)
            .param("id", cellId)
            .update()
    }

    /**
     * Hands every claimed-but-unfinished cell back.
     *
     * A process killed mid-cell leaves rows in `in_progress` that no worker is working on,
     * and nothing would ever pick them up again — the run would resume, find no pending
     * cells, and declare itself finished with holes in it. So a resume starts by releasing
     * them. Their `attempts` count is already incremented, which is what stops a cell that
     * kills the process every time from doing it for ever.
     */
    @Transactional
    fun releaseStaleCells(runId: UUID): Int =
        jdbcClient
            .sql(
                """
                update public.pool_generation_cells
                   set status = cast('pending' as public.pool_cell_status), updated_at = now()
                 where run_id = :run
                   and status = cast('in_progress' as public.pool_cell_status)
                """.trimIndent(),
            ).param("run", runId)
            .update()

    fun progress(run: PoolRun): PoolRunProgress {
        val counts =
            jdbcClient
                .sql(
                    """
                    select status::text as status,
                           count(*)::integer as cells,
                           coalesce(sum(questions_written), 0)::integer as written,
                           coalesce(sum(duplicates_dropped), 0)::integer as dropped
                      from public.pool_generation_cells
                     where run_id = :run
                     group by status
                    """.trimIndent(),
                ).param("run", run.id)
                .query { rs, _ ->
                    Triple(
                        PoolCellStatus.fromDbValue(rs.getString("status")),
                        rs.getInt("cells"),
                        rs.getInt("written") to rs.getInt("dropped"),
                    )
                }.list()

        return PoolRunProgress(
            run = run,
            cells = counts.associate { it.first to it.second },
            questionsWritten = counts.sumOf { it.third.first },
            duplicatesDropped = counts.sumOf { it.third.second },
        )
    }

    private companion object {
        const val RUN_COLUMNS =
            "id, started_at, finished_at, status::text as status, generator_version, " +
                "spend_cap_micro_usd, spent_micro_usd, note"

        const val CELL_COLUMNS =
            "cell.id, cell.run_id, cell.company_id, cell.archetype::text as archetype, " +
                "cell.round_type::text as round_type, cell.role_family::text as role_family, " +
                "cell.level::text as level, cell.status::text as status, cell.attempts"

        fun mapRun(rs: ResultSet) =
            PoolRun(
                id = rs.getObject("id", UUID::class.java),
                startedAt = rs.getTimestamp("started_at").toInstant(),
                finishedAt = rs.getTimestamp("finished_at")?.toInstant(),
                status = PoolRunStatus.fromDbValue(rs.getString("status")),
                generatorVersion = rs.getInt("generator_version"),
                spendCapMicroUsd = rs.getLong("spend_cap_micro_usd"),
                spentMicroUsd = rs.getLong("spent_micro_usd"),
                note = rs.getString("note"),
            )

        fun mapCell(rs: ResultSet) =
            PoolCell(
                id = rs.getObject("id", UUID::class.java),
                runId = rs.getObject("run_id", UUID::class.java),
                coordinate =
                    PoolCoordinate(
                        companyId = rs.getObject("company_id", UUID::class.java),
                        archetype = Archetype.fromDbValue(rs.getString("archetype")) ?: Archetype.GLOBAL_PRODUCT,
                        roundType = RoundType.parseOrNull(rs.getString("round_type")) ?: RoundType.HR_FIT_CLOSING,
                        roleFamily = RoleFamily.fromDbValue(rs.getString("role_family")) ?: RoleFamily.BACKEND,
                        level = Level.fromDbValue(rs.getString("level")) ?: Level.MID,
                    ),
                companyName = rs.getString("company_name"),
                status = PoolCellStatus.fromDbValue(rs.getString("status")),
                attempts = rs.getInt("attempts"),
            )
    }
}

/** One coordinate a run intends to fill. */
data class PlannedCell(
    val coordinate: PoolCoordinate,
    val companyName: String?,
)
