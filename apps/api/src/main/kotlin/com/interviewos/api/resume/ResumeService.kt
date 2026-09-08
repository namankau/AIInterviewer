package com.interviewos.api.resume

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.ParsedEmployment
import com.interviewos.api.ai.ParsedResume
import com.interviewos.api.ai.ResumeFile
import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import java.time.LocalDate
import java.util.UUID

/**
 * Uploading a resume, reading it, and turning it into something an interviewer can use.
 *
 * Parsing is **synchronous** here, unlike the interviewer's voice. The candidate is
 * sitting on an upload screen waiting to find out whether we understood their resume, and
 * an answer they have to come back for is worse than a wait they can see. It is one call,
 * it happens once, and nothing else is blocked by it.
 *
 * The rule that governs everything below: **what the resume says is the candidate's, and
 * what we derived is ours.** The model extracts only what the document states and flags
 * what it was unsure of; totals, gaps and short tenures are computed from the dates by
 * [ResumeTimeline] rather than asked for, because a model asked to add up durations will
 * produce a plausible number instead of a correct one.
 */
@Service
class ResumeService(
    private val repository: ResumeRepository,
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun upload(
        userId: UUID,
        file: ResumeUpload,
    ): ResumeView {
        if (file.bytes.isEmpty()) {
            throw ApiException.badRequest("That file was empty.", code = "empty_resume")
        }
        if (file.bytes.size > MAX_BYTES) {
            throw ApiException.badRequest(
                "That resume is larger than ${MAX_BYTES / 1_000_000}MB. A PDF export is usually well under it.",
                code = "resume_too_large",
            )
        }
        if (!SUPPORTED_TYPES.any { file.contentType.startsWith(it) }) {
            throw ApiException.badRequest(
                "We can read PDF, Word and plain text resumes. That looked like ${file.contentType}.",
                code = "unsupported_resume_type",
            )
        }

        // Ownership is the first path segment, matching the storage RLS policies.
        val path = "$userId/${UUID.randomUUID()}-${file.filename.takeLast(80)}"
        try {
            storage.upload(storageProperties.resumeBucket, path, file.bytes, file.contentType)
        } catch (e: ObjectStorageException) {
            log.warn("Could not store a resume for {}", userId, e)
            throw ApiException.upstreamUnavailable("We could not save that file just now. Please try again.")
        }

        val id =
            repository.insertPending(
                userId = userId,
                bucket = storageProperties.resumeBucket,
                path = path,
                filename = file.filename,
                contentType = file.contentType,
                sizeBytes = file.bytes.size.toLong(),
            )

        val parsed =
            try {
                interviewAi.parseResume(ResumeFile(file.bytes, file.contentType, file.filename)).value
            } catch (e: AiUnavailableException) {
                log.warn("Could not parse resume {} for {}", id, userId, e)
                repository.markFailed(id, userId, e.message ?: "The parser was unavailable.")
                // The file is stored and the row exists, so this is recoverable by
                // re-reading rather than re-uploading. The candidate is told plainly.
                throw ApiException.upstreamUnavailable(
                    "Your resume is saved, but we could not read it just now. Try again shortly.",
                )
            }

        repository.markParsed(id, userId, objectMapper.writeValueAsString(parsed))
        repository.recordDetectedSkills(
            userId,
            parsed.detectedSkills
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .take(MAX_SKILLS),
        )

        // A headline the candidate wrote about themselves beats a job title, so it seeds
        // the profile — but only where they have not already written one of their own.
        parsed.headline?.trim()?.takeIf { it.isNotBlank() }?.let {
            repository.upsertProfile(userId, ProfileUpdate(headline = it))
        }
        // Experience is derived from the dates, never taken from a claim in the text.
        val summary = ResumeTimeline.summarise(parsed.employments, LocalDate.now())
        if (summary.totalExperienceMonths > 0) {
            repository.upsertProfile(userId, ProfileUpdate(totalExperienceMonths = summary.totalExperienceMonths))
        }

        return viewOf(repository.findLatest(userId)!!)
    }

    fun current(userId: UUID): ResumeView? = repository.findLatest(userId)?.let { viewOf(it) }

    fun delete(
        userId: UUID,
        id: UUID,
    ) {
        val removed = repository.delete(id, userId) ?: throw ApiException.notFound()
        // The row is gone either way; a stranded object is a data-protection problem, so
        // the failure is logged loudly rather than swallowed.
        try {
            storage.deleteByPrefix(removed.storageBucket, removed.storagePath)
        } catch (e: ObjectStorageException) {
            log.error("Deleted resume {} but its stored file remains at {}", id, removed.storagePath, e)
        }
    }

    /**
     * What the interviewer is told about the candidate, or null when there is no parsed
     * resume — in which case the round runs on company and role alone, exactly as before.
     */
    fun backgroundFor(userId: UUID): CandidateBackground? {
        val row = repository.findParsed(userId) ?: return null
        val parsed =
            try {
                objectMapper.readValue(row.parsedPayloadJson ?: return null, ParsedResume::class.java)
            } catch (e: RuntimeException) {
                log.warn("Unreadable parsed resume {} for {}", row.id, userId, e)
                return null
            }

        return CandidateBackground(parsed, ResumeTimeline.summarise(parsed.employments, LocalDate.now()))
    }

    private fun viewOf(row: ResumeRow): ResumeView {
        val parsed =
            row.parsedPayloadJson?.let {
                try {
                    objectMapper.readValue(it, ParsedResume::class.java)
                } catch (e: RuntimeException) {
                    log.warn("Unreadable parsed resume {}", row.id, e)
                    null
                }
            }
        val summary = parsed?.let { ResumeTimeline.summarise(it.employments, LocalDate.now()) }

        return ResumeView(
            id = row.id,
            filename = row.originalFilename,
            status = row.parseStatus,
            error = row.parseError,
            uploadedAt = row.uploadedAt?.toString(),
            headline = parsed?.headline,
            employments =
                parsed?.employments?.map {
                    EmploymentView(
                        employer = it.employer,
                        title = it.title,
                        startDate = it.startDate?.toString(),
                        endDate = it.endDate?.toString(),
                        current = it.current,
                    )
                } ?: emptyList(),
            projects =
                parsed?.projects?.map {
                    ProjectView(name = it.name, description = it.description, technologies = it.technologies)
                } ?: emptyList(),
            detectedSkills = parsed?.detectedSkills ?: emptyList(),
            // Surfaced so the candidate can correct us before a round is built on it.
            // A wrong employer silently degrades every future interview.
            lowConfidenceFields = ResumeFlags.worthShowing(parsed?.lowConfidenceFields ?: emptyList()),
            totalExperienceMonths = summary?.totalExperienceMonths,
            gapCount = summary?.gaps?.size ?: 0,
            shortTenureCount = summary?.shortTenures?.size ?: 0,
        )
    }

    private companion object {
        const val MAX_BYTES = 8_000_000
        const val MAX_SKILLS = 60
        val SUPPORTED_TYPES =
            listOf(
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain",
            )
    }
}

data class ResumeUpload(
    val bytes: ByteArray,
    val contentType: String,
    val filename: String,
)

/** The resume as the candidate's own profile page shows it back to them. */
data class ResumeView(
    val id: UUID,
    val filename: String,
    val status: String,
    val error: String?,
    val uploadedAt: String?,
    val headline: String?,
    val employments: List<EmploymentView>,
    val projects: List<ProjectView>,
    val detectedSkills: List<String>,
    val lowConfidenceFields: List<String>,
    val totalExperienceMonths: Int?,
    val gapCount: Int,
    val shortTenureCount: Int,
)

data class EmploymentView(
    val employer: String,
    val title: String?,
    val startDate: String?,
    val endDate: String?,
    val current: Boolean,
)

data class ProjectView(
    val name: String,
    val description: String?,
    val technologies: List<String>,
)

/**
 * The candidate's real work, as the interviewer needs to see it.
 *
 * This is what the project deep-dive round has been missing: without it the interviewer
 * has a company and a job title and has to invent something to ask about. With it, it can
 * ask about the settlement pipeline they actually built.
 */
data class CandidateBackground(
    val resume: ParsedResume,
    val tenure: TenureSummary,
) {
    /**
     * The background as the model should see it.
     *
     * Deliberately framed as *material to draw on*, not as a script, and the caveats are
     * load-bearing. A model handed an employment history will otherwise open with "so you
     * were at Acme for two years" as though it were a fact it had verified, and a
     * mis-parsed date then becomes the interviewer confidently contradicting the
     * candidate about their own career.
     */
    fun asPrompt(): String =
        buildString {
            appendLine("The candidate's own background, parsed from the resume they uploaded:")
            resume.headline?.takeIf { it.isNotBlank() }?.let { appendLine("Headline: $it") }

            val roles = mostRecentFirst(resume.employments)
            if (roles.isNotEmpty()) {
                appendLine()
                appendLine("Roles, most recent first:")
                roles.forEachIndexed { index, job ->
                    append("- ${job.title ?: "role not stated"} at ${job.employer}")
                    val from = job.startDate?.toString()
                    val to = if (job.current) "present" else job.endDate?.toString()
                    if (from != null) append(" ($from to ${to ?: "unstated"})")
                    if (index == 0) append("  <- CURRENT ROLE. Interview them about this one.")
                    appendLine()
                }
            }

            if (resume.projects.isNotEmpty()) {
                appendLine()
                appendLine("Projects they list — these are the strongest thing to ask about:")
                resume.projects.forEach { project ->
                    append("- ${project.name}")
                    project.description?.takeIf { it.isNotBlank() }?.let { append(": $it") }
                    if (project.technologies.isNotEmpty()) append(" [${project.technologies.joinToString(", ")}]")
                    appendLine()
                }
            }

            if (resume.detectedSkills.isNotEmpty()) {
                appendLine()
                appendLine("Skills evidenced by the resume: ${resume.detectedSkills.joinToString(", ")}")
            }

            appendLine()
            appendLine("Derived from the dates (computed by us, not claimed by the resume):")
            appendLine("- About ${tenure.totalExperienceMonths / 12} years of experience.")
            if (tenure.gaps.isNotEmpty()) {
                appendLine("- ${tenure.gaps.size} gap(s) between roles of two months or more.")
            }
            if (tenure.shortTenures.isNotEmpty()) {
                appendLine(
                    "- Short stints: " +
                        tenure.shortTenures.joinToString(", ") { "${it.employer} (${it.months} months)" },
                )
            }

            if (resume.lowConfidenceFields.isNotEmpty()) {
                appendLine()
                appendLine(
                    "We were unsure of these fields when parsing: ${resume.lowConfidenceFields.joinToString(", ")}. " +
                        "Do not state them back as fact.",
                )
            }

            appendLine()
            appendLine(
                "Use this to ground your questions in work they have actually done — a deep-dive into a " +
                    "project they listed is far more revealing than a generic scenario. Three rules. Ask them " +
                    "to tell you about it rather than asserting it back at them: this came from parsing a " +
                    "document and may be wrong, and an interviewer who confidently misstates someone's own " +
                    "career loses them immediately. Do not raise gaps or short stints unless the round " +
                    "type makes that appropriate — in an HR or techno-managerial round it is fair, in a " +
                    "system design round it is not. And anchor on the role at the top of that list: it is " +
                    "what they do now, it is what they remember in detail, and it is what the employer " +
                    "asking about them cares about. Reaching past it to an older job reads as not having " +
                    "read the resume. Earlier roles are worth raising only when the current one genuinely " +
                    "does not cover what the round is testing, or when you are asking how their career got " +
                    "from there to here.",
            )
        }

    /**
     * Roles newest first, because the order they arrive in is the order they happened to
     * be laid out on the page and nothing more.
     *
     * This was a real bug, not a tidiness exercise: the list went to the model unsorted
     * and unlabelled, so it picked whichever role looked most interesting and interviewed
     * a candidate about a job they had left years earlier. Sorting is only half the fix —
     * the first entry is also marked, because a model reading a bare list has no reason to
     * assume the order means anything.
     *
     * `current` wins over dates, since a role marked current is current whatever its start
     * date says. Undated roles sort last rather than first: an unknown date is not
     * evidence of recency, and putting one at the top would reintroduce the bug.
     */
    private fun mostRecentFirst(employments: List<ParsedEmployment>): List<ParsedEmployment> =
        employments.sortedWith(
            compareByDescending<ParsedEmployment> { it.current }
                .thenByDescending { it.endDate ?: if (it.current) LocalDate.MAX else LocalDate.MIN }
                .thenByDescending { it.startDate ?: LocalDate.MIN },
        )
}
