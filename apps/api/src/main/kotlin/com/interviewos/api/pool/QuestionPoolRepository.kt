package com.interviewos.api.pool

import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.RoundType
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

/**
 * Reads and writes `pool_questions`.
 *
 * **There is no method here that writes to `bank_questions`, and there must never be
 * one.** The bank holds what a fetched document says a real employer asked; this holds
 * what a model wrote. Keeping the two writers apart is what stops a generated question
 * ever acquiring a sourced company tag — see the comment at the top of
 * `20260915000000_question_pool.sql`, which is where the reasoning lives.
 */
@Repository
class QuestionPoolRepository(
    private val jdbcClient: JdbcClient,
    /** Used only to encode a `text[]` parameter — see `textArrayFromJson`. */
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private fun jsonArray(values: List<String>): String = objectMapper.writeValueAsString(values)

    /**
     * The schema-qualified name of the `vector` type, or null when the pool has no
     * embedding column.
     *
     * Detected rather than assumed, because the migration's attempt to create pgvector is
     * best effort: creating an extension needs a privilege it may not have. Detected
     * once, lazily — the answer cannot change while the process runs, since nothing here
     * runs DDL, and doing it eagerly would mean a database round trip at startup for a
     * feature most deployments never touch.
     */
    private val vectorType: String? by lazy { detectVectorType() }

    /** Whether the semantic half of deduplication is available at all. */
    val embeddingsSupported: Boolean
        get() = vectorType != null

    private fun detectVectorType(): String? =
        try {
            jdbcClient
                .sql(
                    """
                    select n.nspname as schema
                      from pg_extension e
                      join pg_namespace n on n.oid = e.extnamespace
                     where e.extname = 'vector'
                       and exists (
                             select 1
                               from information_schema.columns
                              where table_schema = 'public'
                                and table_name = 'pool_questions'
                                and column_name = 'embedding'
                           )
                    """.trimIndent(),
                ).query(String::class.java)
                .optional()
                .orElse(null)
                ?.let { "$it.vector" }
                .also {
                    if (it == null) {
                        log.warn(
                            "pool_questions has no embedding column, so the question pool will deduplicate on " +
                                "fingerprints only. Enable the `vector` extension and re-run the embedding block " +
                                "of 20260915000000_question_pool.sql.",
                        )
                    }
                }
        } catch (e: RuntimeException) {
            log.warn("Could not tell whether pgvector is available; deduplicating on fingerprints only", e)
            null
        }

    /**
     * Writes one cell's questions.
     *
     * One transaction per cell, so a cell is never half-written: the cell row is marked
     * done by the caller only after this returns, and a crash between the two leaves the
     * cell pending and its questions absent, which the next resume simply regenerates.
     *
     * @return how many rows were written
     */
    @Transactional
    fun writeBatch(
        cellId: UUID?,
        questions: List<NewPoolQuestion>,
    ): Int {
        if (questions.isEmpty()) return 0
        val embeddingColumn = if (vectorType != null) ", embedding" else ""
        val embeddingValue = if (vectorType != null) ", cast(:embedding as $vectorType)" else ""

        var written = 0
        questions.forEach { question ->
            var spec =
                jdbcClient
                    .sql(
                        """
                        insert into public.pool_questions
                               (company_id, archetype, round_type, role_family, level, text, follow_ups,
                                strong_answer_covers, association, knowledge_basis, cell_id, generator_version,
                                model, payload$embeddingColumn)
                        values (:company, cast(:archetype as public.employer_archetype),
                                cast(:round as public.round_type), cast(:role as public.role_family),
                                cast(:level as public.experience_level), :text,
                                $TEXT_ARRAY_FROM_JSON_FOLLOW_UPS,
                                $TEXT_ARRAY_FROM_JSON_COVERS,
                                cast(:association as public.pool_association), :basis, :cell,
                                :generatorVersion, :model, cast(:payload as jsonb)$embeddingValue)
                        """.trimIndent(),
                    ).param("company", question.coordinate.companyId)
                    .param("archetype", question.coordinate.archetype.dbValue)
                    .param("round", question.coordinate.roundType.dbValue)
                    .param("role", question.coordinate.roleFamily.dbValue)
                    .param("level", question.coordinate.level.dbValue)
                    .param("text", question.text)
                    .param("followUps", jsonArray(question.followUps))
                    .param("covers", jsonArray(question.strongAnswerCovers))
                    .param("association", question.association.dbValue)
                    .param("basis", question.knowledgeBasis)
                    .param("cell", cellId)
                    .param("generatorVersion", question.generatorVersion)
                    .param("model", question.model)
                    .param("payload", question.payload?.let { objectMapper.writeValueAsString(it) })
            if (vectorType != null) {
                spec = spec.param("embedding", question.embedding?.let { literalOf(it) })
            }
            written += spec.update()
        }
        return written
    }

    /**
     * Everything a new batch for [coordinate] must not duplicate.
     *
     * Scoped to the company and round type rather than to the full coordinate: the same
     * question arriving for `mid` and for `senior` is a duplicate a candidate would notice,
     * and the round type is the narrowest scope in which that is true. Deliberately not
     * scoped across companies — the pool is meant to hold the same good behavioural
     * question for many employers.
     *
     * The bank comparison set is capped. It is a comparison set, not the bank: fifty of the
     * best-corroborated sourced questions for this company and round catch a model
     * reproducing a well-known question, and embedding the entire bank per cell would cost
     * more than the generation it is protecting.
     */
    fun existingFor(coordinate: PoolCoordinate): PoolDeduplicator.Existing {
        val pool =
            jdbcClient
                .sql(
                    """
                    select text,
                           fingerprint${if (vectorType != null) ", embedding::text as embedding" else ", null as embedding"}
                      from public.pool_questions
                     where round_type = cast(:round as public.round_type)
                       and (
                             (cast(:company as uuid) is not null and company_id = cast(:company as uuid))
                          or (cast(:company as uuid) is null and company_id is null
                              and archetype = cast(:archetype as public.employer_archetype))
                           )
                       and retired_at is null
                    """.trimIndent(),
                ).param("round", coordinate.roundType.dbValue)
                .param("company", coordinate.companyId)
                .param("archetype", coordinate.archetype.dbValue)
                .query { rs, _ ->
                    StoredQuestion(
                        text = rs.getString("text"),
                        fingerprint = rs.getString("fingerprint"),
                        embedding = rs.getString("embedding")?.let(::parseVector),
                    )
                }.list()

        val bank =
            if (coordinate.companyId == null) {
                emptyList()
            } else {
                jdbcClient
                    .sql(
                        """
                        select b.text, b.fingerprint
                          from public.bank_question_tags t
                          join public.bank_questions b on b.id = t.bank_question_id
                         where t.company_id = :company
                           and (b.round_type is null or b.round_type = cast(:round as public.round_type))
                         order by t.corroboration desc, t.last_reported desc nulls last, b.id
                         limit $BANK_COMPARISON_LIMIT
                        """.trimIndent(),
                    ).param("company", coordinate.companyId)
                    .param("round", coordinate.roundType.dbValue)
                    .query { rs, _ -> rs.getString("text") to rs.getString("fingerprint") }
                    .list()
            }

        return PoolDeduplicator.Existing(
            fingerprints = (pool.map { it.fingerprint } + bank.map { it.second }).toSet(),
            embeddings = pool.mapNotNull { it.embedding },
            bankTexts = bank.map { it.first },
            poolTexts = pool.map { it.text },
        )
    }

    /**
     * The questions a round may use for [coordinate], company rows first and the archetype
     * fallback behind them.
     *
     * The fallback is what makes the pool total: for an employer nobody has generated for
     * by name there is still something to ask, written for the kind of employer, and
     * labelled as exactly that. Task 042 is what reads this.
     */
    fun find(
        coordinate: PoolCoordinate,
        limit: Int,
    ): List<PoolQuestion> =
        jdbcClient
            .sql(
                """
                select $COLUMNS
                  from public.pool_questions
                 where round_type = cast(:round as public.round_type)
                   and role_family = cast(:role as public.role_family)
                   and level = cast(:level as public.experience_level)
                   and retired_at is null
                   and (
                         (cast(:company as uuid) is not null and company_id = cast(:company as uuid))
                      or archetype = cast(:archetype as public.employer_archetype)
                       )
                 order by (company_id is not null and company_id = cast(:company as uuid)) desc,
                          association,
                          reviewed_at desc nulls last,
                          created_at,
                          id
                 limit :limit
                """.trimIndent(),
            ).param("round", coordinate.roundType.dbValue)
            .param("role", coordinate.roleFamily.dbValue)
            .param("level", coordinate.level.dbValue)
            .param("company", coordinate.companyId)
            .param("archetype", coordinate.archetype.dbValue)
            .param("limit", limit)
            .query { rs, _ -> mapRow(rs) }
            .list()

    /** How many live questions the pool holds per company and round type. */
    fun coverage(): Map<Pair<UUID?, RoundType>, Int> =
        jdbcClient
            .sql(
                """
                select company_id, round_type::text as round_type, count(*)::integer as questions
                  from public.pool_questions
                 where retired_at is null
                 group by company_id, round_type
                """.trimIndent(),
            ).query { rs, _ ->
                val round = RoundType.parseOrNull(rs.getString("round_type"))
                round?.let { (rs.getObject("company_id", UUID::class.java) to it) to rs.getInt("questions") }
            }.list()
            .filterNotNull()
            .toMap()

    /**
     * Retires questions rather than deleting them.
     *
     * A retired question stops being served — every lookup is partial on `retired_at is
     * null` — but stays readable, because "why did this round ask that" has to remain
     * answerable about a round that has already happened.
     */
    @Transactional
    fun retire(
        ids: Collection<UUID>,
        at: Instant = Instant.now(),
    ): Int {
        if (ids.isEmpty()) return 0
        return jdbcClient
            .sql(
                """
                update public.pool_questions
                   set retired_at = :at, updated_at = now()
                 where id in (:ids)
                   and retired_at is null
                """.trimIndent(),
            ).param("at", Timestamp.from(at))
            .param("ids", ids.toList())
            .update()
    }

    /** Everything one run wrote, for the owner's export. */
    fun exportRun(runId: UUID): List<PoolExportRow> =
        jdbcClient
            .sql(
                """
                select q.id,
                       c.name as company_name,
                       c.slug as company_slug,
                       q.archetype::text as archetype,
                       q.round_type::text as round_type,
                       q.role_family::text as role_family,
                       q.level::text as level,
                       q.association::text as association,
                       q.knowledge_basis,
                       q.text,
                       q.follow_ups,
                       q.strong_answer_covers,
                       q.model,
                       q.generator_version,
                       q.payload::text as payload,
                       q.created_at
                  from public.pool_questions q
                  join public.pool_generation_cells cell on cell.id = q.cell_id
                  left join public.companies c on c.id = q.company_id
                 where cell.run_id = :run
                 order by c.name nulls first, q.round_type, q.role_family, q.level, q.created_at, q.id
                """.trimIndent(),
            ).param("run", runId)
            .query { rs, _ ->
                PoolExportRow(
                    id = rs.getObject("id", UUID::class.java),
                    companyName = rs.getString("company_name"),
                    companySlug = rs.getString("company_slug"),
                    archetype = rs.getString("archetype"),
                    roundType = rs.getString("round_type"),
                    roleFamily = rs.getString("role_family"),
                    level = rs.getString("level"),
                    association = rs.getString("association"),
                    knowledgeBasis = rs.getString("knowledge_basis"),
                    text = rs.getString("text"),
                    followUps = stringArray(rs, "follow_ups"),
                    strongAnswerCovers = stringArray(rs, "strong_answer_covers"),
                    model = rs.getString("model"),
                    generatorVersion = rs.getInt("generator_version"),
                    payload = rs.getString("payload")?.let { objectMapper.readTree(it) },
                    createdAt = rs.getTimestamp("created_at").toInstant(),
                )
            }.list()

    private fun mapRow(rs: ResultSet): PoolQuestion =
        PoolQuestion(
            id = rs.getObject("id", UUID::class.java),
            coordinate =
                PoolCoordinate(
                    companyId = rs.getObject("company_id", UUID::class.java),
                    archetype = Archetype.fromDbValue(rs.getString("archetype")) ?: Archetype.GLOBAL_PRODUCT,
                    roundType = RoundType.parseOrNull(rs.getString("round_type")) ?: RoundType.HR_FIT_CLOSING,
                    roleFamily = RoleFamily.fromDbValue(rs.getString("role_family")) ?: RoleFamily.BACKEND,
                    level = Level.fromDbValue(rs.getString("level")) ?: Level.MID,
                ),
            text = rs.getString("text"),
            followUps = stringArray(rs, "follow_ups"),
            strongAnswerCovers = stringArray(rs, "strong_answer_covers"),
            association = Association.fromDbValue(rs.getString("association")),
            knowledgeBasis = rs.getString("knowledge_basis"),
            generatorVersion = rs.getInt("generator_version"),
            model = rs.getString("model"),
            fingerprint = rs.getString("fingerprint"),
            reviewedAt = rs.getTimestamp("reviewed_at")?.toInstant(),
            retiredAt = rs.getTimestamp("retired_at")?.toInstant(),
            payload = rs.getString("payload")?.let { objectMapper.readTree(it) },
        )

    /** One pool row, as deduplication needs it. */
    private data class StoredQuestion(
        val text: String,
        val fingerprint: String,
        val embedding: FloatArray?,
    ) {
        // Array-valued equality would compare references, which is never what a caller
        // means. Nothing compares these, so the members are not generated.
        override fun equals(other: Any?): Boolean = this === other

        override fun hashCode(): Int = System.identityHashCode(this)
    }

    private companion object {
        const val BANK_COMPARISON_LIMIT = 50

        /**
         * A `text[]` built from a JSON array parameter, in order.
         *
         * The driver will not bind a Kotlin `List` or `Array` to a Postgres array column,
         * and building a `{"a","b"}` literal in Kotlin means hand-rolling Postgres array
         * quoting for text that came from a model — one unescaped backslash away from a
         * corrupted row. JSON has an encoder already, and `with ordinality` keeps the
         * follow-ups in the order the interviewer should reach for them, which
         * `array_agg` over a set-returning function does not otherwise promise.
         */
        fun textArrayFromJson(parameter: String): String =
            "(select coalesce(array_agg(e.value order by e.ord), '{}'::text[]) " +
                "from jsonb_array_elements_text(cast(:$parameter as jsonb)) with ordinality as e(value, ord))"

        val TEXT_ARRAY_FROM_JSON_FOLLOW_UPS = textArrayFromJson("followUps")
        val TEXT_ARRAY_FROM_JSON_COVERS = textArrayFromJson("covers")

        const val COLUMNS =
            "id, company_id, archetype::text as archetype, round_type::text as round_type, " +
                "role_family::text as role_family, level::text as level, text, follow_ups, " +
                "strong_answer_covers, association::text as association, knowledge_basis, " +
                "generator_version, model, fingerprint, reviewed_at, retired_at, payload::text as payload"

        fun stringArray(
            rs: ResultSet,
            column: String,
        ): List<String> {
            @Suppress("UNCHECKED_CAST")
            return (rs.getArray(column)?.array as? Array<String>)?.toList() ?: emptyList()
        }

        /** pgvector's text form: `[0.1,0.2,0.3]`. */
        fun literalOf(vector: FloatArray): String = vector.joinToString(",", prefix = "[", postfix = "]")

        fun parseVector(literal: String): FloatArray? {
            val body = literal.trim().removePrefix("[").removeSuffix("]")
            if (body.isBlank()) return null
            val parts = body.split(',')
            return FloatArray(parts.size) { i -> parts[i].trim().toFloatOrNull() ?: return null }
        }
    }
}

/** One line of the owner's export. */
data class PoolExportRow(
    val id: UUID,
    val companyName: String?,
    val companySlug: String?,
    val archetype: String,
    val roundType: String,
    val roleFamily: String,
    val level: String,
    val association: String,
    val knowledgeBasis: String?,
    val text: String,
    val followUps: List<String>,
    val strongAnswerCovers: List<String>,
    val model: String,
    val generatorVersion: Int,
    val payload: JsonNode? = null,
    val createdAt: Instant,
)
