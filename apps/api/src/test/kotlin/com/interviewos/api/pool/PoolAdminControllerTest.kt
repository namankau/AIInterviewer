package com.interviewos.api.pool

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyList
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.core.task.SyncTaskExecutor
import org.springframework.core.task.TaskExecutor
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

/**
 * The admin routes: start or resume a run, watch it, and read what it wrote.
 *
 * Both halves of the gate are covered — a caller with no token at all, and a signed-in
 * caller who is not on the allow-list — because this is not a candidate-facing feature and
 * a leak here would show somebody the questions they are about to be asked.
 */
@WebMvcTest(PoolAdminController::class)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    PoolAdminControllerTest.Executors::class,
)
class PoolAdminControllerTest {
    /** The run is worked inline, so a test never has to wait for a background thread. */
    @TestConfiguration
    class Executors {
        @Bean(name = ["interviewBackgroundExecutor"])
        fun interviewBackgroundExecutor(): TaskExecutor = SyncTaskExecutor()

        /**
         * Real properties, not a mock: `enabled = false` is the shipped default and the
         * state this task leaves the product in, so the routes are tested in it.
         */
        @Bean
        fun poolProperties(): PoolProperties = PoolProperties(enabled = false)
    }

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var adminAccess: AdminAccess

    @MockitoBean
    private lateinit var planner: PoolRunPlanner

    @MockitoBean
    private lateinit var runs: PoolRunRepository

    @MockitoBean
    private lateinit var pool: QuestionPoolRepository

    @MockitoBean
    private lateinit var job: PoolGenerationJob

    @MockitoBean
    private lateinit var export: PoolExport

    private val operator =
        SupabaseIdentity(UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11"), "op@example.com", null)
    private val runId = UUID.fromString("88888888-8888-8888-8888-888888888888")

    private fun run() =
        PoolRun(
            id = runId,
            startedAt = Instant.parse("2026-09-15T09:00:00Z"),
            finishedAt = null,
            status = PoolRunStatus.PAUSED,
            generatorVersion = 1,
            spendCapMicroUsd = 2_000_000,
            spentMicroUsd = 0,
            note = null,
        )

    private fun progress() = PoolRunProgress(run(), mapOf(PoolCellStatus.PENDING to 4), 0, 0)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(operator.id.toString())
                .claim("email", operator.email)
        }

    @Test
    fun `an admin can plan a run`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(job.supportedRoundTypes).willReturn(setOf(RoundType.HR_FIT_CLOSING))
        given(planner.plan(anyList(), anyList(), anyList(), anyList(), anyBoolean())).willReturn(
            listOf(
                PlannedCell(
                    PoolCoordinate(null, Archetype.GLOBAL_PRODUCT, RoundType.HR_FIT_CLOSING, RoleFamily.BACKEND, Level.MID),
                    null,
                ),
            ),
        )
        given(runs.createRun(anyInt(), anyLong(), any())).willReturn(run())
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress())

        mockMvc
            .perform(
                post("/api/v1/admin/pool/runs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """{"companies":["amazon"],"roundTypes":["hr_fit_closing"],""" +
                            """"roleFamilies":["backend"],"levels":["mid"]}""",
                    ),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(runId.toString()))
            .andExpect(jsonPath("$.totalCells").value(4))
            // The owner has to be able to see that a run was planned but nothing will be
            // spent until they say so.
            .andExpect(jsonPath("$.generationEnabled").value(false))

        verify(runs).planCells(anyArg(), anyList())
    }

    @Test
    fun `a round type nothing generates for is refused up front`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(job.supportedRoundTypes).willReturn(setOf(RoundType.HR_FIT_CLOSING))

        mockMvc
            .perform(
                post("/api/v1/admin/pool/runs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """{"roundTypes":["system_design"],"roleFamilies":["backend"],"levels":["mid"]}""",
                    ),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("no_generator"))

        verifyNoInteractions(runs)
    }

    @Test
    fun `a role family outside the wave-one list is refused`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(job.supportedRoundTypes).willReturn(setOf(RoundType.HR_FIT_CLOSING))

        mockMvc
            .perform(
                post("/api/v1/admin/pool/runs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """{"roundTypes":["hr_fit_closing"],"roleFamilies":["product_management"],"levels":["mid"]}""",
                    ),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("unknown_value"))
    }

    @Test
    fun `status reports the cells`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(runs.findRun(runId)).willReturn(run())
        given(runs.progress(anyArg())).willReturn(progress())

        mockMvc
            .perform(get("/api/v1/admin/pool/runs/$runId").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("paused"))
            .andExpect(jsonPath("$.cells.pending").value(4))
    }

    @Test
    fun `the export comes back as a JSONL file`() {
        given(adminAccess.require(operator)).willReturn(operator)
        given(runs.findRun(runId)).willReturn(run())
        given(pool.exportRun(runId)).willReturn(emptyList())
        given(export.render(anyList())).willReturn("{\"question\":\"Why us?\"}\n")

        mockMvc
            .perform(get("/api/v1/admin/pool/runs/$runId/export").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(PoolExport.CONTENT_TYPE))
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"pool-run-$runId.jsonl\""))
            .andExpect(content().string("{\"question\":\"Why us?\"}\n"))
    }

    @Test
    fun `a caller with no token gets nothing`() {
        mockMvc
            .perform(get("/api/v1/admin/pool/runs/$runId/export"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(runs, pool, export)
    }

    @Test
    fun `a signed-in caller who is not an admin is told the run does not exist`() {
        // Deliberately a 404 rather than a 403: a 403 confirms the endpoint is there and
        // that the caller is merely off the list, which is more than they need to know.
        given(adminAccess.require(operator)).willThrow(ApiException.notFound())

        mockMvc
            .perform(get("/api/v1/admin/pool/runs/$runId/export").with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(runs, pool, export)
    }

    @Test
    fun `a non-admin cannot start a run either`() {
        given(adminAccess.require(operator)).willThrow(ApiException.notFound())

        mockMvc
            .perform(
                post("/api/v1/admin/pool/runs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"roundTypes":["hr_fit_closing"],"roleFamilies":["backend"],"levels":["mid"]}"""),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(runs, planner, job)
    }
}
