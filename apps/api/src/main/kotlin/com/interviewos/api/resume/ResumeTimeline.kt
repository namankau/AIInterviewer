package com.interviewos.api.resume

import com.interviewos.api.ai.ParsedEmployment
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** A gap between two employments, long enough to be worth a candidate explaining. */
data class EmploymentGap(
    val fromDate: LocalDate,
    val toDate: LocalDate,
    val months: Int,
)

/** A stint short enough that an interviewer may ask why it ended. */
data class ShortTenure(
    val employer: String,
    val months: Int,
)

data class TenureSummary(
    val totalExperienceMonths: Int,
    val gaps: List<EmploymentGap>,
    val shortTenures: List<ShortTenure>,
)

/**
 * Derives experience, gaps and short tenures from parsed employment dates. This is the
 * kind of quiet arithmetic where a wrong sign or an off-by-one silently misleads every
 * downstream interview, so it is pure, deterministic, and heavily tested (task 002, §8).
 *
 * The model never computes these — it only extracts dates (see the resume-parse prompt).
 * Overlapping roles are merged so concurrent work is not double-counted, and a role in
 * progress is measured to [referenceDate].
 */
object ResumeTimeline {
    private const val DEFAULT_GAP_THRESHOLD_MONTHS = 2
    private const val DEFAULT_SHORT_TENURE_MONTHS = 12

    fun summarise(
        employments: List<ParsedEmployment>,
        referenceDate: LocalDate,
        gapThresholdMonths: Int = DEFAULT_GAP_THRESHOLD_MONTHS,
        shortTenureMonths: Int = DEFAULT_SHORT_TENURE_MONTHS,
    ): TenureSummary {
        // Only dated roles can be measured; undated ones are flagged low-confidence upstream.
        val intervals =
            employments
                .mapNotNull { employment ->
                    val start = employment.startDate ?: return@mapNotNull null
                    val end = resolveEnd(employment, referenceDate)
                    if (end.isBefore(start)) null else Interval(start, end)
                }.sortedBy { it.start }

        val merged = mergeOverlaps(intervals)
        val total = merged.sumOf { monthsBetween(it.start, it.end) }

        val gaps =
            merged.zipWithNext().mapNotNull { (earlier, later) ->
                val months = monthsBetween(earlier.end, later.start)
                if (months >= gapThresholdMonths) EmploymentGap(earlier.end, later.start, months) else null
            }

        val shortTenures =
            employments.mapNotNull { employment ->
                // A role in progress is not "short" — it is unfinished. Only closed stints count.
                if (employment.current || employment.endDate == null) return@mapNotNull null
                val start = employment.startDate ?: return@mapNotNull null
                val months = monthsBetween(start, employment.endDate)
                if (months in 0 until shortTenureMonths) ShortTenure(employment.employer, months) else null
            }

        return TenureSummary(total, gaps, shortTenures)
    }

    private fun resolveEnd(
        employment: ParsedEmployment,
        referenceDate: LocalDate,
    ): LocalDate =
        when {
            employment.current -> referenceDate
            employment.endDate != null -> employment.endDate
            else -> referenceDate
        }

    private fun mergeOverlaps(intervals: List<Interval>): List<Interval> {
        if (intervals.isEmpty()) return emptyList()
        val merged = mutableListOf(intervals.first())
        for (next in intervals.drop(1)) {
            val last = merged.last()
            if (!next.start.isAfter(last.end)) {
                merged[merged.size - 1] = Interval(last.start, maxOf(last.end, next.end))
            } else {
                merged.add(next)
            }
        }
        return merged
    }

    private fun monthsBetween(
        start: LocalDate,
        end: LocalDate,
    ): Int = ChronoUnit.MONTHS.between(start, end).toInt()

    private data class Interval(
        val start: LocalDate,
        val end: LocalDate,
    )
}
