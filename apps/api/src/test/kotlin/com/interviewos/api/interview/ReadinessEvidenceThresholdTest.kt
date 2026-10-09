package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReadinessEvidenceThresholdTest {
    private val repository = mock(SessionRepository::class.java)
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    private val service = ReadinessService(repository, mapper)
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `a one-answer report does not become a readiness percentage`() {
        given(repository.listReportsForReadiness(candidate)).willReturn(
            listOf(row("2026-10-09T10:00:00Z", assessableTurns = 1, score = 2)),
        )

        val group = service.readiness(candidate).single()

        assertNull(group.firstAverageScore)
        assertNull(group.latestAverageScore)
    }

    @Test
    fun `the first report with enough evidence becomes the readiness baseline`() {
        given(repository.listReportsForReadiness(candidate)).willReturn(
            listOf(
                row("2026-10-09T10:00:00Z", assessableTurns = 1, score = 4),
                row("2026-10-09T11:00:00Z", assessableTurns = 2, score = 2),
            ),
        )

        val group = service.readiness(candidate).single()

        assertEquals(40.0, group.firstAverageScore)
        assertEquals(40.0, group.latestAverageScore)
        assertEquals(2, group.sessionsCompleted)
    }

    private fun row(
        endedAt: String,
        assessableTurns: Int,
        score: Int,
    ) = ReadinessRow(
        companyName = "General practice",
        roleTitle = "Role not specified",
        endedAt = Instant.parse(endedAt),
        payloadJson =
            mapper.writeValueAsString(
                mapOf(
                    "answeredTurns" to assessableTurns,
                    "assessableTurns" to assessableTurns,
                    "competencies" to listOf(mapOf("competency" to "Design", "score" to score, "maxScore" to 5)),
                ),
            ),
    )
}
