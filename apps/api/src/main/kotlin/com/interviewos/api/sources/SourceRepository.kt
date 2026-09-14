package com.interviewos.api.sources

import com.interviewos.api.bank.SourceOrigin
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * The curated source library: the reading list, and its state.
 *
 * What was read out of each source lives in the question bank (`com.interviewos.api.bank`),
 * written by `QuestionBankWriter`. Every report there carries the source it came from and
 * cannot exist without one, which is what lets a candidate follow a question to something
 * they can go and check.
 */
@Repository
class SourceRepository(
    private val jdbcClient: JdbcClient,
) {
    fun addLink(
        addedBy: UUID,
        url: String,
        title: String?,
        publisher: String?,
        companyName: String?,
        origin: SourceOrigin? = null,
        publishedOn: LocalDate? = null,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.interview_sources
                       (added_by, kind, url, title, publisher, company_name, origin, published_on)
                values (:u, 'link', :url, :title, :publisher, :company,
                        cast(:origin as public.source_origin), :published)
                on conflict (url) do update
                   set title = coalesce(excluded.title, public.interview_sources.title),
                       publisher = coalesce(excluded.publisher, public.interview_sources.publisher),
                       company_name = coalesce(excluded.company_name, public.interview_sources.company_name),
                       origin = coalesce(excluded.origin, public.interview_sources.origin),
                       published_on = coalesce(excluded.published_on, public.interview_sources.published_on),
                       -- Re-adding a link is how an operator asks for it to be re-read.
                       status = 'pending'
                returning id
                """.trimIndent(),
            ).param("u", addedBy)
            .param("url", url)
            .param("title", title)
            .param("publisher", publisher)
            .param("company", companyName)
            .param("origin", origin?.dbValue)
            .param("published", publishedOn)
            .query(UUID::class.java)
            .single()

    fun addDocument(
        addedBy: UUID,
        bucket: String,
        path: String,
        title: String?,
        publisher: String?,
        companyName: String?,
        origin: SourceOrigin? = null,
        publishedOn: LocalDate? = null,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.interview_sources
                       (added_by, kind, storage_bucket, storage_path, title, publisher, company_name, origin, published_on)
                values (:u, 'document', :bucket, :path, :title, :publisher, :company,
                        cast(:origin as public.source_origin), :published)
                returning id
                """.trimIndent(),
            ).param("u", addedBy)
            .param("bucket", bucket)
            .param("path", path)
            .param("title", title)
            .param("publisher", publisher)
            .param("company", companyName)
            .param("origin", origin?.dbValue)
            .param("published", publishedOn)
            .query(UUID::class.java)
            .single()

    fun list(): List<SourceRow> =
        jdbcClient
            .sql(
                """
                select $COLUMNS,
                       (select count(distinct q.bank_question_id) from public.source_questions q
                         where q.source_id = s.id) as question_count
                  from public.interview_sources s
                 order by s.created_at desc
                """.trimIndent(),
            ).query { rs, _ -> mapSource(rs) }
            .list()

    /**
     * Sources due a read: never read, previously failed, last read before [staleBefore],
     * or read by an extractor older than [extractorVersion].
     *
     * Blocked ones are excluded — robots.txt said no, and asking again on a timer is how a
     * reading list turns into the crawler this must not become. Only a *fetched* source is
     * re-read for being behind the extractor: one that keeps failing waits for its weekly
     * turn rather than being retried every six hours because its version never moves.
     */
    fun due(
        staleBefore: Instant,
        extractorVersion: Int,
        limit: Int,
    ): List<SourceRow> =
        jdbcClient
            .sql(
                """
                select $COLUMNS, 0 as question_count
                  from public.interview_sources s
                 where s.status <> 'blocked'
                   and (s.last_fetched_at is null
                        or s.last_fetched_at < :stale
                        or (s.status = 'fetched' and s.extractor_version < :version))
                 order by s.last_fetched_at nulls first
                 limit :limit
                """.trimIndent(),
            ).param("stale", java.sql.Timestamp.from(staleBefore))
            .param("version", extractorVersion)
            .param("limit", limit)
            .query { rs, _ -> mapSource(rs) }
            .list()

    /**
     * Records the outcome of a read. [extractorVersion] is set only when questions were
     * actually extracted (or confirmed current); a failure leaves it where it was.
     */
    fun markFetched(
        id: UUID,
        status: SourceStatus,
        contentHash: String?,
        error: String?,
        extractorVersion: Int? = null,
    ) {
        jdbcClient
            .sql(
                """
                update public.interview_sources
                   set status = cast(:status as public.source_status),
                       last_fetched_at = now(),
                       content_hash = coalesce(:hash, content_hash),
                       fetch_error = :error,
                       extractor_version = coalesce(:version, extractor_version)
                 where id = :id
                """.trimIndent(),
            ).param("status", status.dbValue)
            .param("hash", contentHash)
            .param("error", error)
            .param("version", extractorVersion)
            .param("id", id)
            .update()
    }

    /**
     * Removes a source, every report it made, and every bank question that nothing else
     * reports.
     *
     * The last part is what makes deleting a source mean what an operator expects. A source
     * is usually deleted because it should never have been read — and then its text should
     * not linger in the bank as an orphan, invisible but still stored. Questions another
     * source also reports stay, with one citation fewer.
     */
    @Transactional
    fun delete(id: UUID) {
        val reported =
            jdbcClient
                .sql(
                    """
                    select distinct bank_question_id from public.source_questions
                     where source_id = :id and bank_question_id is not null
                    """.trimIndent(),
                ).param("id", id)
                .query(UUID::class.java)
                .list()

        jdbcClient.sql("delete from public.interview_sources where id = :id").param("id", id).update()

        if (reported.isNotEmpty()) {
            jdbcClient
                .sql(
                    """
                    delete from public.bank_questions b
                     where b.id in (:ids)
                       and not exists (select 1 from public.source_questions q where q.bank_question_id = b.id)
                    """.trimIndent(),
                ).param("ids", reported)
                .update()
        }
    }

    private fun mapSource(rs: ResultSet) =
        SourceRow(
            id = rs.getObject("id", UUID::class.java),
            kind = rs.getString("kind"),
            url = rs.getString("url"),
            storageBucket = rs.getString("storage_bucket"),
            storagePath = rs.getString("storage_path"),
            title = rs.getString("title"),
            publisher = rs.getString("publisher"),
            publishedOn = rs.getDate("published_on")?.toLocalDate(),
            companyName = rs.getString("company_name"),
            origin = SourceOrigin.fromDbValue(rs.getString("origin")),
            status = rs.getString("status"),
            lastFetchedAt = rs.getTimestamp("last_fetched_at")?.toInstant(),
            fetchError = rs.getString("fetch_error"),
            contentHash = rs.getString("content_hash"),
            extractorVersion = rs.getInt("extractor_version"),
            questionCount = rs.getInt("question_count"),
        )

    private companion object {
        const val COLUMNS =
            "s.id, s.kind::text as kind, s.url, s.storage_bucket, s.storage_path, " +
                "s.title, s.publisher, s.published_on, s.company_name, s.origin::text as origin, " +
                "s.status::text as status, s.last_fetched_at, s.fetch_error, s.content_hash, s.extractor_version"
    }
}

data class SourceRow(
    val id: UUID,
    val kind: String,
    val url: String?,
    val storageBucket: String?,
    val storagePath: String?,
    val title: String?,
    val publisher: String?,
    val publishedOn: LocalDate?,
    val companyName: String?,
    val origin: SourceOrigin?,
    val status: String,
    val lastFetchedAt: Instant?,
    val fetchError: String?,
    val contentHash: String?,
    val extractorVersion: Int,
    val questionCount: Int,
)

enum class SourceStatus(
    val dbValue: String,
) {
    PENDING("pending"),
    FETCHED("fetched"),
    FAILED("failed"),
    BLOCKED("blocked"),
}
