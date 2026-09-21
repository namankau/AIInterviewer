package com.interviewos.api.courses

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * Which course chapters the signed-in candidate has finished.
 *
 * Progress is attached to the account, not the browser, so it follows a candidate to a
 * second device or a lab machine and is gone the moment they sign out of a shared one.
 *
 * Every route derives the candidate from the verified token and no route accepts a user
 * id, so one candidate cannot read or write another's progress.
 */
@RestController
@RequestMapping("/api/v1/me/course-progress")
class CourseProgressController(
    private val repository: CourseProgressRepository,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun progress(
        @AuthenticationPrincipal jwt: Jwt,
    ): CourseProgressView = CourseProgressView(completed = repository.findAll(SupabaseIdentity.from(jwt).id))

    @PutMapping("/{courseSlug}/{chapterSlug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markComplete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable courseSlug: String,
        @PathVariable chapterSlug: String,
    ) {
        val identity = SupabaseIdentity.from(jwt)
        // Any entry point that writes user-owned rows provisions rather than assuming
        // GET /me ran first: a candidate can land on a chapter straight from a link.
        userRepository.provision(identity)
        repository.markComplete(identity.id, requireSlug(courseSlug, "courseSlug"), requireSlug(chapterSlug, "chapterSlug"))
    }

    @DeleteMapping("/{courseSlug}/{chapterSlug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markIncomplete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable courseSlug: String,
        @PathVariable chapterSlug: String,
    ) {
        repository.markIncomplete(
            SupabaseIdentity.from(jwt).id,
            requireSlug(courseSlug, "courseSlug"),
            requireSlug(chapterSlug, "chapterSlug"),
        )
    }

    /**
     * Imports progress a candidate had saved in a browser before this was account-backed.
     *
     * A union, never a replacement: importing cannot remove anything the account already
     * has, and importing the same set twice changes nothing. The client asks the candidate
     * first — on a shared computer the progress in that browser may not be theirs, so it
     * is never merged silently.
     */
    @PostMapping("/import")
    fun import(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: ImportCourseProgressRequest,
    ): CourseProgressView {
        val identity = SupabaseIdentity.from(jwt)
        if (request.chapters.size > MAX_IMPORT) {
            throw ApiException.badRequest("Cannot import more than $MAX_IMPORT chapters at once.")
        }
        val entries =
            request.chapters.map {
                CourseChapter(requireSlug(it.courseSlug, "courseSlug"), requireSlug(it.chapterSlug, "chapterSlug"))
            }
        userRepository.provision(identity)
        repository.markAllComplete(identity.id, entries)
        return CourseProgressView(completed = repository.findAll(identity.id))
    }

    /**
     * Slugs come from static course content, so they are a known, narrow shape. Checked
     * explicitly rather than with a validation annotation because a constraint violation
     * on a path variable is not one of the cases `ApiExceptionHandler` renders, so it
     * would surface as a 500 where this gives an honest 400.
     */
    private fun requireSlug(
        value: String,
        field: String,
    ): String {
        if (!SLUG.matches(value)) throw ApiException.badRequest("$field must be a lower-case slug.")
        return value
    }

    private companion object {
        val SLUG = Regex("[a-z0-9][a-z0-9-]{0,199}")
        const val MAX_IMPORT = 2_000
    }
}

/** `GET /api/v1/me/course-progress` — completed chapter slugs, keyed by course slug. */
data class CourseProgressView(
    val completed: Map<String, List<String>>,
)

data class ImportCourseProgressRequest(
    val chapters: List<ImportedChapter> = emptyList(),
)

data class ImportedChapter(
    val courseSlug: String,
    val chapterSlug: String,
)
