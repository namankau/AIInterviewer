package com.interviewos.api.courses

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/**
 * Chapters a candidate has marked complete.
 *
 * Every method takes the user id the caller derived from a verified token; none of them
 * accepts it from a request body, so one candidate can never read or write another's
 * progress.
 */
@Repository
class CourseProgressRepository(
    private val jdbcClient: JdbcClient,
) {
    /** Everything this candidate has completed, grouped by course slug. */
    fun findAll(userId: UUID): Map<String, List<String>> =
        jdbcClient
            .sql(
                """
                select course_slug, chapter_slug
                from public.course_progress
                where user_id = :userId
                order by course_slug, chapter_slug
                """.trimIndent(),
            ).param("userId", userId)
            .query { rs, _ -> rs.getString("course_slug") to rs.getString("chapter_slug") }
            .list()
            .groupBy({ it.first }, { it.second })

    /**
     * Marks one chapter complete. Idempotent: the primary key makes a repeat a no-op
     * rather than a duplicate row or an error, so a double-click and a retried request
     * both behave the way the candidate expects.
     */
    fun markComplete(
        userId: UUID,
        courseSlug: String,
        chapterSlug: String,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.course_progress (user_id, course_slug, chapter_slug)
                values (:userId, :courseSlug, :chapterSlug)
                on conflict (user_id, course_slug, chapter_slug) do nothing
                """.trimIndent(),
            ).param("userId", userId)
            .param("courseSlug", courseSlug)
            .param("chapterSlug", chapterSlug)
            .update()
    }

    /** Un-marks a chapter. Absence is "not complete", so this is a plain delete. */
    fun markIncomplete(
        userId: UUID,
        courseSlug: String,
        chapterSlug: String,
    ) {
        jdbcClient
            .sql(
                """
                delete from public.course_progress
                where user_id = :userId and course_slug = :courseSlug and chapter_slug = :chapterSlug
                """.trimIndent(),
            ).param("userId", userId)
            .param("courseSlug", courseSlug)
            .param("chapterSlug", chapterSlug)
            .update()
    }

    /**
     * Adds several chapters at once, for importing progress that was saved in a browser
     * before this was account-backed. A union: it never removes anything the account
     * already has, so importing twice cannot lose work.
     */
    fun markAllComplete(
        userId: UUID,
        entries: List<CourseChapter>,
    ) {
        if (entries.isEmpty()) return
        jdbcClient
            .sql(
                """
                insert into public.course_progress (user_id, course_slug, chapter_slug)
                values (:userId, :courseSlug, :chapterSlug)
                on conflict (user_id, course_slug, chapter_slug) do nothing
                """.trimIndent(),
            ).let { spec ->
                entries.forEach { entry ->
                    spec
                        .param("userId", userId)
                        .param("courseSlug", entry.courseSlug)
                        .param("chapterSlug", entry.chapterSlug)
                        .update()
                }
            }
    }
}

/** One chapter within one course. */
data class CourseChapter(
    val courseSlug: String,
    val chapterSlug: String,
)
