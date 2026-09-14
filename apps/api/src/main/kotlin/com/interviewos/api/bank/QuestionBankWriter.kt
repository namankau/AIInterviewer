package com.interviewos.api.bank

import com.interviewos.api.ai.ExtractedQuestion
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * The only thing that writes to the bank.
 *
 * It records what a fetched document says was asked, and nothing else. There is no method
 * here for adding a question directly, and that is the design: a question the model wrote
 * in a round, or a "suggested" one, has no source behind it, and putting it in the bank
 * would launder model knowledge into a sourced claim.
 *
 * Tags are not written either. A report — source S says Q was asked at C — is written, and
 * `bank_question_tags` derives the tag from it, so a tag cannot outlive its evidence.
 */
@Component
class QuestionBankWriter(
    private val jdbcClient: JdbcClient,
    private val directory: CompanyDirectory,
) {
    /**
     * Replaces everything [sourceId] reports with [questions]. A re-read supersedes rather
     * than accumulates.
     *
     * One transaction, so a source is never half-replaced. Bank questions are upserted on
     * their fingerprint and keep their id across re-reads, which is what lets a later task
     * remember which questions a candidate has already been asked.
     *
     * @param declaredCompany the company the operator filed the source under, used for any
     *   question whose text names no employer
     * @return how many distinct questions were recorded
     */
    @Transactional
    fun replaceReports(
        sourceId: UUID,
        declaredCompany: String?,
        questions: List<ExtractedQuestion>,
    ): Int {
        jdbcClient.sql("delete from public.source_questions where source_id = :s").param("s", sourceId).update()

        val planned = ReportPlan.plan(questions, declaredCompany)
        val companies = HashMap<String, Company?>()

        planned.forEach { question ->
            val bankQuestionId = upsertQuestion(question)
            val targets: List<String?> = question.companies.ifEmpty { listOf(null) }
            targets.forEach { name ->
                val company =
                    name?.let { companies.getOrPut(EmployerNames.lookupKey(it)) { directory.resolveOrCreate(it) } }
                insertReport(sourceId, bankQuestionId, company, name, question)
            }
        }
        return planned.size
    }

    private fun upsertQuestion(question: PlannedQuestion): UUID =
        jdbcClient
            .sql(
                """
                insert into public.bank_questions (text, round_type)
                values (:text, cast(:round as public.round_type))
                on conflict (fingerprint) do update
                   set round_type = coalesce(public.bank_questions.round_type, excluded.round_type),
                       updated_at = now()
                returning id
                """.trimIndent(),
            ).param("text", question.text)
            .param("round", question.roundType?.dbValue)
            .query(UUID::class.java)
            .single()

    private fun insertReport(
        sourceId: UUID,
        bankQuestionId: UUID,
        company: Company?,
        companyName: String?,
        question: PlannedQuestion,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.source_questions
                       (source_id, bank_question_id, company_id, company_name, role_family, round_type,
                        seniority, question_text, notes, asked_on)
                values (:s, :bank, :company, :companyName, :role, cast(:round as public.round_type),
                        :seniority, :text, :notes, :asked)
                """.trimIndent(),
            ).param("s", sourceId)
            .param("bank", bankQuestionId)
            .param("company", company?.id)
            // The name as the document gave it, kept alongside the resolved company so a
            // wrong resolution can be seen and corrected.
            .param("companyName", companyName)
            .param("role", question.roleFamily)
            .param("round", question.roundType?.dbValue)
            .param("seniority", question.seniority)
            .param("text", question.text)
            .param("notes", question.notes)
            .param("asked", question.askedOn)
            .update()
    }
}
