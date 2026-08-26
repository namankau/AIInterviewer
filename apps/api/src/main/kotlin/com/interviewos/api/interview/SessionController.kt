package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

/**
 * The interview loop, on the versioned public API. Mobile will consume these unchanged.
 *
 * Every route derives the caller from the verified token subject. No route accepts a
 * user id, and every repository call is scoped by it, so one candidate cannot reach
 * another's session, media or report.
 */
@RestController
@RequestMapping("/api/v1")
class SessionController(
    private val interviewService: InterviewService,
    private val reportService: ReportService,
    private val readinessService: ReadinessService,
) {
    @GetMapping("/entitlement")
    fun entitlement(
        @AuthenticationPrincipal jwt: Jwt,
    ): EntitlementView = interviewService.entitlement(callerOf(jwt))

    @GetMapping("/sessions")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<SessionSummary> = interviewService.list(callerOf(jwt))

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    fun start(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: StartSessionRequest,
    ): SessionView = interviewService.start(callerOf(jwt), request)

    @GetMapping("/sessions/{id}")
    fun session(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ): SessionView = interviewService.view(callerOf(jwt), id)

    /**
     * Submits one spoken answer. Multipart because the browser sends captured audio and,
     * when the candidate consented, video.
     */
    @PostMapping("/sessions/{id}/turns")
    fun submitAnswer(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @RequestParam turnIndex: Int,
        @RequestParam audio: MultipartFile,
        @RequestParam(required = false) video: MultipartFile?,
    ): SubmitAnswerResponse {
        if (audio.isEmpty) {
            throw ApiException.badRequest("We did not receive any audio for that answer.", code = "empty_answer")
        }
        return interviewService.submitAnswer(
            userId = callerOf(jwt),
            sessionId = id,
            turnIndex = turnIndex,
            audio = AnswerAudio(audio.bytes, audio.contentType ?: "audio/webm"),
            video = video?.takeIf { !it.isEmpty }?.bytes,
            videoContentType = video?.contentType,
        )
    }

    @PostMapping("/sessions/{id}/abandon")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun abandon(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) = interviewService.abandon(callerOf(jwt), id)

    @GetMapping("/sessions/{id}/report")
    fun report(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ): Map<String, Any?> = reportService.report(callerOf(jwt), id)

    @GetMapping("/readiness")
    fun readiness(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ReadinessGroup> = readinessService.readiness(callerOf(jwt))

    private fun callerOf(jwt: Jwt): UUID = SupabaseIdentity.from(jwt).id
}
