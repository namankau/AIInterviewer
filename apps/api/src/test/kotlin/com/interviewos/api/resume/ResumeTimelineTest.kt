package com.interviewos.api.resume

import com.interviewos.api.ai.ParsedEmployment
import org.junit.jupiter.api.Test
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The arithmetic behind "about six years of experience" and "a nine-month gap in 2024".
 *
 * Its own documentation said it was heavily tested. It was not — this is that test. It
 * matters because every number here is stated back to a candidate about their own career,
 * and an interviewer that gets somebody's history wrong loses them immediately.
 */
class ResumeTimelineTest {
    private val today = LocalDate.parse("2026-09-08")

    private fun job(
        employer: String,
        from: String?,
        to: String?,
        current: Boolean = false,
    ) = ParsedEmployment(
        employer = employer,
        title = "Engineer",
        level = null,
        startDate = from?.let(LocalDate::parse),
        endDate = to?.let(LocalDate::parse),
        current = current,
    )

    @Test
    fun `adds up continuous employment`() {
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Acme", "2020-01-01", "2022-01-01"),
                    job("Globex", "2022-01-01", "2024-01-01"),
                ),
                today,
            )

        assertEquals(48, summary.totalExperienceMonths)
        assertTrue(summary.gaps.isEmpty())
    }

    @Test
    fun `a role still in progress is measured to today`() {
        val summary = ResumeTimeline.summarise(listOf(job("Acme", "2024-09-08", null, current = true)), today)

        assertEquals(24, summary.totalExperienceMonths)
    }

    /**
     * Someone who contracted for one employer while employed by another has not worked
     * two jobs' worth of years, and telling them they have is an obvious error to them
     * and an invisible one to us.
     */
    @Test
    fun `overlapping roles are not double-counted`() {
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Acme", "2020-01-01", "2023-01-01"),
                    job("Moonlight", "2021-01-01", "2022-01-01"),
                ),
                today,
            )

        assertEquals(36, summary.totalExperienceMonths)
    }

    @Test
    fun `a gap between roles is found and measured`() {
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Acme", "2020-01-01", "2021-01-01"),
                    job("Globex", "2021-10-01", "2023-01-01"),
                ),
                today,
            )

        val gap = summary.gaps.single()
        assertEquals(9, gap.months)
        assertEquals(LocalDate.parse("2021-01-01"), gap.fromDate)
        assertEquals(LocalDate.parse("2021-10-01"), gap.toDate)
    }

    @Test
    fun `a normal job change is not reported as a gap`() {
        // Four weeks between jobs is a notice period, not something to explain.
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Acme", "2020-01-01", "2021-01-01"),
                    job("Globex", "2021-01-28", "2023-01-01"),
                ),
                today,
            )

        assertTrue(summary.gaps.isEmpty())
    }

    @Test
    fun `short stints are named, long ones are not`() {
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Brief Co", "2020-01-01", "2020-06-01"),
                    job("Steady Co", "2020-06-01", "2024-06-01"),
                ),
                today,
            )

        assertEquals(listOf("Brief Co"), summary.shortTenures.map { it.employer })
        assertEquals(5, summary.shortTenures.single().months)
    }

    /**
     * Undated roles are flagged as low-confidence by the parser rather than guessed at.
     * They must not silently count as zero-length work or crash the summary.
     */
    @Test
    fun `undated roles are skipped rather than guessed`() {
        val summary =
            ResumeTimeline.summarise(
                listOf(
                    job("Acme", "2020-01-01", "2022-01-01"),
                    job("Mystery Co", null, null),
                ),
                today,
            )

        assertEquals(24, summary.totalExperienceMonths)
    }

    @Test
    fun `an end date before the start date is discarded rather than counted backwards`() {
        val summary = ResumeTimeline.summarise(listOf(job("Typo Co", "2023-01-01", "2020-01-01")), today)

        assertEquals(0, summary.totalExperienceMonths)
    }

    @Test
    fun `an empty resume summarises to nothing rather than failing`() {
        val summary = ResumeTimeline.summarise(emptyList(), today)

        assertEquals(0, summary.totalExperienceMonths)
        assertTrue(summary.gaps.isEmpty())
        assertTrue(summary.shortTenures.isEmpty())
    }
}
