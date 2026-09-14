package com.interviewos.api.loopbrief

import com.interviewos.api.ai.ExtractedProcessStage
import com.interviewos.api.bank.CompanyDirectory
import com.interviewos.api.bank.EmployerNames
import com.interviewos.api.interview.RoundType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * The only thing that writes to `source_process_stages`.
 *
 * Mirrors `QuestionBankWriter`: a re-read of a source replaces what it reported rather
 * than accumulating duplicates, and a stage that fails the evidence check
 * ([ProcessStageVerifier]) is never written at all — not stored-but-flagged, gone.
 */
@Component
class ProcessStageWriter(
    private val jdbcClient: JdbcClient,
    private val directory: CompanyDirectory,
) {
    /**
     * Replaces everything [sourceId] reports as process stages with the verified subset
     * of [stages].
     *
     * @param declaredCompany the company the operator filed the source under, used for
     *   any stage that names no employer
     * @param documentText the fetched document's own text, which every stage's evidence
     *   must actually occur in
     * @return how many stage rows were written
     */
    @Transactional
    fun replaceStages(
        sourceId: UUID,
        declaredCompany: String?,
        stages: List<ExtractedProcessStage>,
        documentText: String,
    ): Int {
        jdbcClient.sql("delete from public.source_process_stages where source_id = :s").param("s", sourceId).update()

        val verified = ProcessStageVerifier.verify(documentText, stages)
        val fallback = declaredCompany?.takeIf { EmployerNames.isNamedEmployer(it) }?.let { EmployerNames.displayName(it) }
        var written = 0

        verified.forEach { stage ->
            val named =
                stage.companies
                    .filter { EmployerNames.isNamedEmployer(it) }
                    .map { EmployerNames.displayName(it) }
            val companies = named.ifEmpty { listOfNotNull(fallback) }
            val targets: List<String?> = companies.distinctBy { EmployerNames.lookupKey(it) }.ifEmpty { listOf(null) }

            targets.forEach { name ->
                val company = name?.let { directory.resolveOrCreate(it) }
                insert(sourceId, company?.id, name, stage)
                written += 1
            }
        }
        return written
    }

    private fun insert(
        sourceId: UUID,
        companyId: UUID?,
        companyName: String?,
        stage: ExtractedProcessStage,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.source_process_stages
                       (source_id, company_id, company_name, role_family, stage_order, stage_name,
                        format, duration_minutes, assesses, round_type, evidence)
                values (:s, :company, :companyName, :role, :order, :name,
                        :format, :duration, :assesses, cast(:round as public.round_type), :evidence)
                """.trimIndent(),
            ).param("s", sourceId)
            .param("company", companyId)
            .param("companyName", companyName)
            .param("role", stage.roleFamily?.trim()?.takeIf { it.isNotEmpty() })
            .param("order", stage.order)
            .param("name", stage.stageName.trim())
            .param("format", stage.format?.trim()?.takeIf { it.isNotEmpty() })
            .param("duration", stage.durationMinutes)
            .param("assesses", stage.assesses?.trim()?.takeIf { it.isNotEmpty() })
            .param("round", stage.roundType?.let { RoundType.parseOrNull(it.trim()) }?.dbValue)
            .param("evidence", stage.evidence.trim())
            .update()
    }
}
