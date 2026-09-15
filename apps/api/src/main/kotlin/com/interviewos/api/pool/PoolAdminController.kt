package com.interviewos.api.pool

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.RoundType
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * Starting, watching and reading a question-pool generation run.
 *
 * **Admin only, and never candidate-facing.** The pool is not a browsable question bank —
 * it is what a round reaches for when nothing sourced exists, and a candidate who could
 * read it before a round would be reading their own interview. There is no public route to
 * any of this, and task 042 is what teaches rounds to use it.
 *
 * The gate is [AdminAccess], the same one the source library uses: the caller's verified
 * email against a configured allow-list. It is the weakest part of this task and worth
 * being plain about — see the note on the export, which is the endpoint where it matters
 * most.
 */
@RestController
@RequestMapping("/api/v1/admin/pool")
class PoolAdminController(
    private val adminAccess: AdminAccess,
    private val planner: PoolRunPlanner,
    private val runs: PoolRunRepository,
    private val pool: QuestionPoolRepository,
    private val job: PoolGenerationJob,
    private val export: PoolExport,
    private val properties: PoolProperties,
    @Qualifier("interviewBackgroundExecutor") private val executor: TaskExecutor,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Starts a new run, or resumes one by id.
     *
     * The response does not wait for the run: a full pass is hours of rate-limited calls,
     * and an HTTP request that held open for it would time out somewhere in the middle
     * with the run still going. So this plans the work, hands it to the background
     * executor, and answers with the run — `GET /runs/{id}` is how progress is watched.
     *
     * With `interviewos.pool.enabled` false — the default — the plan is written and
     * nothing else happens. That is not a half-finished feature: it is how the shape and
     * size of a run can be reviewed before anybody agrees to pay for it (CLAUDE.md rule 7).
     */
    @PostMapping("/runs")
    fun startOrResume(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: StartRunRequest,
    ): RunView {
        adminAccess.require(SupabaseIdentity.from(jwt))

        val run =
            if (request.runId != null) {
                val existing = parseUuid(request.runId).let { runs.findRun(it) } ?: throw ApiException.notFound()
                if (existing.status == PoolRunStatus.RUNNING) {
                    throw ApiException.conflict("That run is already going.", "run_in_progress")
                }
                existing
            } else {
                val roundTypes = parseRoundTypes(request.roundTypes)
                val roleFamilies = parse(request.roleFamilies) { RoleFamily.require(it) }
                val levels = parse(request.levels) { Level.require(it) }
                val cells =
                    planner.plan(
                        companySlugs = request.companies,
                        roundTypes = roundTypes,
                        roleFamilies = roleFamilies,
                        levels = levels,
                        includeArchetypeCells = request.includeArchetypeCells,
                    )
                val created =
                    runs.createRun(
                        generatorVersion = request.generatorVersion,
                        spendCapMicroUsd = request.spendCapMicroUsd ?: properties.defaultSpendCapMicroUsd,
                        note = request.note,
                    )
                runs.planCells(created.id, cells)
                created
            }

        executor.execute {
            try {
                job.run(run.id)
            } catch (e: RuntimeException) {
                // The request has already been answered, so this is the only place the
                // failure can surface. The run's own status is set by the job.
                log.error("Generation run {} stopped with an error", run.id, e)
            }
        }

        return view(runs.progress(runs.findRun(run.id) ?: run))
    }

    @GetMapping("/runs/{id}")
    fun status(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: String,
    ): RunView {
        adminAccess.require(SupabaseIdentity.from(jwt))
        val run = runs.findRun(parseUuid(id)) ?: throw ApiException.notFound()
        return view(runs.progress(run))
    }

    /**
     * Everything the run wrote, as a file.
     *
     * This is what the owner actually reads before a full pass, so it carries the
     * provenance fields on every line — which questions claim to be about the employer,
     * and what the model said to earn that claim. Reviewing the pool without those is
     * reviewing the prose and not the honesty.
     */
    @GetMapping("/runs/{id}/export")
    fun exportRun(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: String,
    ): ResponseEntity<ByteArray> {
        adminAccess.require(SupabaseIdentity.from(jwt))
        val run = runs.findRun(parseUuid(id)) ?: throw ApiException.notFound()
        val body = export.render(pool.exportRun(run.id)).toByteArray(Charsets.UTF_8)
        return ResponseEntity
            .ok()
            .contentType(MediaType.parseMediaType(PoolExport.CONTENT_TYPE))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"${PoolExport.fileNameFor(run)}\"")
            .body(body)
    }

    private fun view(progress: PoolRunProgress): RunView =
        RunView(
            id = progress.run.id.toString(),
            status = progress.run.status.dbValue,
            startedAt = progress.run.startedAt.toString(),
            finishedAt = progress.run.finishedAt?.toString(),
            generatorVersion = progress.run.generatorVersion,
            spendCapMicroUsd = progress.run.spendCapMicroUsd,
            spentMicroUsd = progress.run.spentMicroUsd,
            note = progress.run.note,
            generationEnabled = properties.enabled,
            totalCells = progress.totalCells,
            cells = progress.cells.mapKeys { it.key.dbValue },
            questionsWritten = progress.questionsWritten,
            duplicatesDropped = progress.duplicatesDropped,
        )

    private fun parseUuid(value: String): UUID =
        try {
            UUID.fromString(value)
        } catch (e: IllegalArgumentException) {
            throw ApiException.notFound()
        }

    private fun parseRoundTypes(values: List<String>): List<RoundType> {
        val parsed =
            values.map { value ->
                RoundType.parseOrNull(value.trim().lowercase())
                    ?: throw ApiException.badRequest("'$value' is not a round type.", "unknown_round_type")
            }
        // Refused up front rather than skipped silently eight hundred cells later. Tasks
        // 040 and 041 add the missing generators; until then a run that asks for one of
        // them would plan work nothing can do.
        val unsupported = parsed.filterNot { it in job.supportedRoundTypes }
        if (unsupported.isNotEmpty()) {
            throw ApiException.badRequest(
                "Nothing generates ${unsupported.joinToString { it.dbValue }} yet.",
                "no_generator",
            )
        }
        return parsed
    }

    private fun <T> parse(
        values: List<String>,
        parser: (String) -> T,
    ): List<T> =
        values.map { value ->
            try {
                parser(value)
            } catch (e: IllegalArgumentException) {
                throw ApiException.badRequest(e.message ?: "'$value' is not valid here.", "unknown_value")
            }
        }
}

/**
 * @param runId resume this run instead of planning a new one. Everything else is ignored
 *   when it is set — a resume works the plan that already exists, which is what makes it a
 *   resume rather than a second run over the same ground.
 */
data class StartRunRequest(
    val runId: String? = null,
    val companies: List<String> = emptyList(),
    val roundTypes: List<String> = emptyList(),
    val roleFamilies: List<String> = emptyList(),
    val levels: List<String> = emptyList(),
    val includeArchetypeCells: Boolean = true,
    val spendCapMicroUsd: Long? = null,
    val generatorVersion: Int = 1,
    val note: String? = null,
)

data class RunView(
    val id: String,
    val status: String,
    val startedAt: String,
    val finishedAt: String?,
    val generatorVersion: Int,
    val spendCapMicroUsd: Long,
    val spentMicroUsd: Long,
    val note: String?,
    /** False means the run is planned but nothing will be generated until the owner says so. */
    val generationEnabled: Boolean,
    val totalCells: Int,
    val cells: Map<String, Int>,
    val questionsWritten: Int,
    val duplicatesDropped: Int,
)
