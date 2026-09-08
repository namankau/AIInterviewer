package com.interviewos.api.sources

import com.interviewos.api.ai.ExtractedQuestion
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * The curated source library, and the questions read out of it.
 *
 * Every question row carries the source it came from and cannot exist without one, which
 * is what lets the report link a question to something a candidate can go and check.
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
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.interview_sources (added_by, kind, url, title, publisher, company_name)
                values (:u, 'link', :url, :title, :publisher, :company)
                on conflict (url) do update
                   set title = coalesce(excluded.title, public.interview_sources.title),
                       publisher = coalesce(excluded.publisher, public.interview_sources.publisher),
                       company_name = coalesce(excluded.company_name, public.interview_sources.company_name),
                       -- Re-adding a link is how an operator asks for it to be re-read.
                       status = 'pending'
                returning id
                """.trimIndent(),
            ).param("u", addedBy)
            .param("url", url)
            .param("title", title)
            .param("publisher", publisher)
            .param("company", companyName)
            .query(UUID::class.java)
            .single()

    fun addDocument(
        addedBy: UUID,
        bucket: String,
        path: String,
        title: String?,
        publisher: String?,
        companyName: String?,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.interview_sources
                       (added_by, kind, storage_bucket, storage_path, title, publisher, company_name)
                values (:u, 'document', :bucket, :path, :title, :publisher, :company)
                returning id
                """.trimIndent(),
            ).param("u", addedBy)
            .param("bucket", bucket)
            .param("path", path)
            .param("title", title)
            .param("publisher", publisher)
            .param("company", companyName)
            .query(UUID::class.java)
            .single()

    fun list(): List<SourceRow> =
        jdbcClient
            .sql(
                """
                select s.id, s.kind::text as kind, s.url, s.storage_bucket, s.storage_path,
                       s.title, s.publisher, s.published_on, s.company_name,
                       s.status::text as status, s.last_fetched_at, s.fetch_error, s.content_hash,
                       (select count(*) from public.source_questions q where q.source_id = s.id) as question_count
                  from public.interview_sources s
                 order by s.created_at desc
                """.trimIndent(),
            ).query { rs, _ -> mapSource(rs) }
            .list()

    /**
     * Sources due a read: never read, previously failed, or last read before [staleBefore].
     * Blocked ones are excluded — robots.txt said no, and asking again on a timer is how a
     * reading list turns into the crawler this must not become.
     */
    fun due(
        staleBefore: Instant,
        limit: Int,
    ): List<SourceRow> =
        jdbcClient
            .sql(
                """
                select s.id, s.kind::text as kind, s.url, s.storage_bucket, s.storage_path,
                       s.title, s.publisher, s.published_on, s.company_name,
                       s.status::text as status, s.last_fetched_at, s.fetch_error, s.content_hash,
                       0 as question_count
                  from public.interview_sources s
                 where s.status <> 'blocked'
                   and (s.last_fetched_at is null or s.last_fetched_at < :stale)
                 order by s.last_fetched_at nulls first
                 limit :limit
                """.trimIndent(),
            ).param("stale", java.sql.Timestamp.from(staleBefore))
            .param("limit", limit)
            .query { rs, _ -> mapSource(rs) }
            .list()

    fun markFetched(
        id: UUID,
        status: SourceStatus,
        contentHash: String?,
        error: String?,
    ) {
        jdbcClient
            .sql(
                """
                update public.interview_sources
                   set status = cast(:status as public.source_status),
                       last_fetched_at = now(),
                       content_hash = coalesce(:hash, content_hash),
                       fetch_error = :error
                 where id = :id
                """.trimIndent(),
            ).param("status", status.dbValue)
            .param("hash", contentHash)
            .param("error", error)
            .param("id", id)
            .update()
    }

    /** Replaces a source's extracted questions. A re-read supersedes rather than accumulates. */
    fun replaceQuestions(
        sourceId: UUID,
        questions: List<ExtractedQuestion>,
    ) {
        jdbcClient.sql("delete from public.source_questions where source_id = :s").param("s", sourceId).update()
        questions.forEach { question ->
            jdbcClient
                .sql(
                    """
                    insert into public.source_questions
                           (source_id, company_name, role_family, round_type, seniority, question_text, notes, asked_on)
                    values (:s, :company, :role, cast(:round as public.round_type), :seniority, :text, :notes, :asked)
                    """.trimIndent(),
                ).param("s", sourceId)
                .param("company", question.companyName)
                .param("role", question.roleFamily)
                .param("round", question.roundType)
                .param("seniority", question.seniority)
                .param("text", question.questionText)
                .param("notes", question.notes)
                .param("asked", question.askedOn)
                .update()
        }
    }

    fun delete(id: UUID) {
        jdbcClient.sql("delete from public.interview_sources where id = :id").param("id", id).update()
    }

    /**
     * Real, sourced questions for an employer and round, newest first.
     *
     * Matched on the company name the operator recorded. Deliberately exact (case aside):
     * a fuzzy match that returned Google's questions for "Google Cloud India" would be
     * inventing employer-specific detail through the back door.
     */
    fun questionsFor(
        companyName: String,
        roundType: String,
        limit: Int,
    ): List<SourcedQuestion> =
        jdbcClient
            .sql(
                """
                select q.question_text, q.notes, q.asked_on, q.seniority,
                       s.id as source_id, s.title, s.publisher, s.url, s.published_on
                  from public.source_questions q
                  join public.interview_sources s on s.id = q.source_id
                 where lower(q.company_name) = lower(:company)
                   and (q.round_type is null or q.round_type = cast(:round as public.round_type))
                   and s.status = 'fetched'
                 order by q.asked_on desc nulls last
                 limit :limit
                """.trimIndent(),
            ).param("company", companyName)
            .param("round", roundType)
            .param("limit", limit)
            .query { rs, _ ->
                SourcedQuestion(
                    questionText = rs.getString("question_text"),
                    notes = rs.getString("notes"),
                    askedOn = rs.getDate("asked_on")?.toLocalDate(),
                    seniority = rs.getString("seniority"),
                    sourceId = rs.getObject("source_id", UUID::class.java),
                    title = rs.getString("title"),
                    publisher = rs.getString("publisher"),
                    url = rs.getString("url"),
                    publishedOn = rs.getDate("published_on")?.toLocalDate(),
                )
            }.list()

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
            status = rs.getString("status"),
            lastFetchedAt = rs.getTimestamp("last_fetched_at")?.toInstant(),
            fetchError = rs.getString("fetch_error"),
            contentHash = rs.getString("content_hash"),
            questionCount = rs.getInt("question_count"),
        )
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
    val status: String,
    val lastFetchedAt: Instant?,
    val fetchError: String?,
    val contentHash: String?,
    val questionCount: Int,
)

/** A question read out of a source, with the source attached. Never one without the other. */
data class SourcedQuestion(
    val questionText: String,
    val notes: String?,
    val askedOn: LocalDate?,
    val seniority: String?,
    val sourceId: UUID,
    val title: String?,
    val publisher: String?,
    val url: String?,
    val publishedOn: LocalDate?,
)

enum class SourceStatus(
    val dbValue: String,
) {
    PENDING("pending"),
    FETCHED("fetched"),
    FAILED("failed"),
    BLOCKED("blocked"),
}
