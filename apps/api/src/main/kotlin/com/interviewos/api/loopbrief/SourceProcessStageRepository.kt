package com.interviewos.api.loopbrief

import com.interviewos.api.bank.BankCitation
import com.interviewos.api.bank.SourceOrigin
import com.interviewos.api.interview.RoundType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/** One (source, stage) report, before stages reported by more than one source are merged. */
data class SourceProcessStageRow(
    val stageName: String,
    val roleFamily: String?,
    val stageOrder: Int?,
    val format: String?,
    val durationMinutes: Int?,
    val assesses: String?,
    val roundType: RoundType?,
    val citation: BankCitation,
)

/** Reads verified process stages, joined with the source they were reported by. */
@Repository
class SourceProcessStageRepository(
    private val jdbcClient: JdbcClient,
) {
    /** Every stage a fetched source reports for [companyId], one row per (source, stage). */
    fun stagesFor(companyId: UUID): List<SourceProcessStageRow> =
        jdbcClient
            .sql(
                """
                select st.stage_name, st.role_family, st.stage_order, st.format, st.duration_minutes,
                       st.assesses, st.round_type::text as round_type,
                       s.id as source_id, s.title, s.publisher, s.url, s.published_on, s.origin::text as origin
                  from public.source_process_stages st
                  join public.interview_sources s on s.id = st.source_id
                 where st.company_id = :company
                   and s.status = 'fetched'
                 order by st.stage_order nulls last, s.published_on desc nulls last, st.id
                """.trimIndent(),
            ).param("company", companyId)
            .query { rs, _ ->
                val url = rs.getString("url")
                SourceProcessStageRow(
                    stageName = rs.getString("stage_name"),
                    roleFamily = rs.getString("role_family"),
                    stageOrder = rs.getObject("stage_order") as? Int,
                    format = rs.getString("format"),
                    durationMinutes = rs.getObject("duration_minutes") as? Int,
                    assesses = rs.getString("assesses"),
                    roundType = rs.getString("round_type")?.let { RoundType.parseOrNull(it) },
                    citation =
                        BankCitation(
                            sourceId = rs.getObject("source_id", UUID::class.java),
                            title = rs.getString("title") ?: url ?: "Untitled source",
                            publisher = rs.getString("publisher"),
                            url = url,
                            year = rs.getDate("published_on")?.toLocalDate()?.year,
                            origin = SourceOrigin.fromDbValue(rs.getString("origin")),
                        ),
                )
            }.list()
}
