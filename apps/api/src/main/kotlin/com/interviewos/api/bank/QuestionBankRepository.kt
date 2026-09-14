package com.interviewos.api.bank

import com.interviewos.api.interview.RoundType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/**
 * Reads the bank. Everything here goes through `bank_question_tags`, so only questions a
 * fetched source reports are ever returned, and each comes back with every company tag it
 * carries and every source behind it.
 *
 * Companies are passed as ids from [CompanyDirectory], never as names: which employer a
 * name means is decided in exactly one place.
 */
@Repository
class QuestionBankRepository(
    private val jdbcClient: JdbcClient,
) {
    /** Every company with at least one sourced question, with counts per round type, by name. */
    fun companiesWithQuestions(): List<CompanyCoverage> =
        jdbcClient
            .sql(
                """
                select ${CompanyDirectory.COLUMNS}, b.round_type::text as round_type,
                       count(*)::integer as questions
                  from public.bank_question_tags t
                  join public.companies c on c.id = t.company_id
                  join public.bank_questions b on b.id = t.bank_question_id
                 group by c.id, b.round_type
                 order by lower(c.name), b.round_type
                """.trimIndent(),
            ).query { rs, _ ->
                Triple(
                    CompanyDirectory.mapRow(rs),
                    rs.getString("round_type")?.let { RoundType.parseOrNull(it) },
                    rs.getInt("questions"),
                )
            }.list()
            .groupBy({ it.first }, { it.second to it.third })
            .map { (company, counts) -> CompanyCoverage(company, counts.toMap()) }

    /** One company's sourced questions per round type. Empty when it has none. */
    fun coverage(company: Company): CompanyCoverage {
        val counts =
            jdbcClient
                .sql(
                    """
                    select b.round_type::text as round_type, count(*)::integer as questions
                      from public.bank_question_tags t
                      join public.bank_questions b on b.id = t.bank_question_id
                     where t.company_id = :company
                     group by b.round_type
                    """.trimIndent(),
                ).param("company", company.id)
                .query { rs, _ -> rs.getString("round_type")?.let { RoundType.parseOrNull(it) } to rs.getInt("questions") }
                .list()
                .toMap()
        return CompanyCoverage(company, counts)
    }

    /**
     * Questions tagged to [companyId], most corroborated first, then most recent.
     *
     * @param roundType only this round type, or every round type when null
     * @param includeUnclassified with a [roundType], also questions no source placed in a
     *   round — right for grounding a round, wrong for a filter a candidate chose
     */
    fun questionsFor(
        companyId: UUID,
        roundType: RoundType? = null,
        includeUnclassified: Boolean = false,
        limit: Int = 20,
        offset: Int = 0,
    ): List<BankQuestion> {
        val ids =
            jdbcClient
                .sql(
                    """
                    select b.id
                      from public.bank_question_tags t
                      join public.bank_questions b on b.id = t.bank_question_id
                     where t.company_id = :company
                       and $ROUND_FILTER
                     order by t.corroboration desc, t.last_reported desc nulls last, b.created_at, b.id
                     limit :limit offset :offset
                    """.trimIndent(),
                ).param("company", companyId)
                .param("round", roundType?.dbValue)
                .param("unclassified", includeUnclassified)
                .param("limit", limit)
                .param("offset", offset)
                .query { rs, _ -> rs.getObject("id", UUID::class.java) }
                .list()
        return hydrate(ids)
    }

    /** How many questions [questionsFor] would page through. */
    fun countFor(
        companyId: UUID,
        roundType: RoundType? = null,
        includeUnclassified: Boolean = false,
    ): Int =
        jdbcClient
            .sql(
                """
                select count(*)::integer
                  from public.bank_question_tags t
                  join public.bank_questions b on b.id = t.bank_question_id
                 where t.company_id = :company
                   and $ROUND_FILTER
                """.trimIndent(),
            ).param("company", companyId)
            .param("round", roundType?.dbValue)
            .param("unclassified", includeUnclassified)
            .query(Int::class.java)
            .single()

    /** One question, or null when it does not exist or no fetched source reports it. */
    fun byId(id: UUID): BankQuestion? = hydrate(listOf(id)).firstOrNull()

    /** Full questions for [ids], in the order given. Unbacked ids are dropped. */
    private fun hydrate(ids: List<UUID>): List<BankQuestion> {
        if (ids.isEmpty()) return emptyList()

        val tags =
            jdbcClient
                .sql(
                    """
                    select t.bank_question_id, ${CompanyDirectory.COLUMNS}, t.corroboration, t.last_reported
                      from public.bank_question_tags t
                      join public.companies c on c.id = t.company_id
                     where t.bank_question_id in (:ids)
                     order by t.corroboration desc, lower(c.name)
                    """.trimIndent(),
                ).param("ids", ids)
                .query { rs, _ ->
                    rs.getObject("bank_question_id", UUID::class.java) to
                        CompanyTag(
                            company = CompanyDirectory.mapRow(rs),
                            corroboration = rs.getInt("corroboration"),
                            lastReported = rs.getDate("last_reported")?.toLocalDate(),
                        )
                }.list()
                .groupBy({ it.first }, { it.second })

        val citations =
            jdbcClient
                .sql(
                    """
                    select distinct q.bank_question_id, s.id as source_id, s.title, s.publisher, s.url,
                           s.published_on, s.origin::text as origin
                      from public.source_questions q
                      join public.interview_sources s on s.id = q.source_id
                     where s.status = 'fetched'
                       and q.bank_question_id in (:ids)
                     order by q.bank_question_id, s.published_on desc nulls last, s.id
                    """.trimIndent(),
                ).param("ids", ids)
                .query { rs, _ ->
                    val url = rs.getString("url")
                    rs.getObject("bank_question_id", UUID::class.java) to
                        BankCitation(
                            sourceId = rs.getObject("source_id", UUID::class.java),
                            title = rs.getString("title") ?: url ?: "Untitled source",
                            publisher = rs.getString("publisher"),
                            url = url,
                            year = rs.getDate("published_on")?.toLocalDate()?.year,
                            origin = SourceOrigin.fromDbValue(rs.getString("origin")),
                        )
                }.list()
                .groupBy({ it.first }, { it.second })

        val questions =
            jdbcClient
                .sql(
                    """
                    select b.id, b.text, b.round_type::text as round_type,
                           count(distinct q.source_id)::integer as corroboration,
                           coalesce(max(q.asked_on), max(s.published_on)) as last_reported,
                           (array_agg(q.notes order by q.created_at) filter (where q.notes is not null))[1] as notes
                      from public.bank_questions b
                      join public.source_questions q on q.bank_question_id = b.id
                      join public.interview_sources s on s.id = q.source_id
                     where s.status = 'fetched'
                       and b.id in (:ids)
                     group by b.id
                    """.trimIndent(),
                ).param("ids", ids)
                .query { rs, _ ->
                    val id = rs.getObject("id", UUID::class.java)
                    BankQuestion(
                        id = id,
                        text = rs.getString("text"),
                        roundType = rs.getString("round_type")?.let { RoundType.parseOrNull(it) },
                        companies = tags[id].orEmpty(),
                        citations = citations[id].orEmpty(),
                        corroboration = rs.getInt("corroboration"),
                        lastReported = rs.getDate("last_reported")?.toLocalDate(),
                        notes = rs.getString("notes"),
                    )
                }.list()
                .associateBy { it.id }

        return ids.mapNotNull { questions[it] }
    }

    private companion object {
        /** `:round` null means every round type; see [questionsFor] for `:unclassified`. */
        const val ROUND_FILTER =
            "(cast(:round as text) is null " +
                "or b.round_type = cast(:round as public.round_type) " +
                "or (:unclassified and b.round_type is null))"
    }
}
