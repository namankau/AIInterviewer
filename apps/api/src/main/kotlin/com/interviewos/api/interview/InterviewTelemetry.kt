package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class InterviewClientEventRequest(
    @field:NotBlank
    val event: String,
    @field:Min(0)
    val turnIndex: Int,
    @field:Min(0)
    @field:Max(120_000)
    val durationMs: Long? = null,
)

/**
 * Records the small, fixed set of failures that can only be observed in the browser.
 *
 * The payload intentionally excludes free-form detail, URLs, device data, transcript,
 * question text and audio. A fixed vocabulary makes these events safe to aggregate and
 * prevents this support endpoint becoming an accidental personal-data sink.
 */
@Service
class InterviewTelemetryService(
    private val repository: SessionRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun record(
        userId: UUID,
        sessionId: UUID,
        request: InterviewClientEventRequest,
    ) {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (request.event !in ALLOWED_EVENTS) {
            throw ApiException.badRequest(
                message = "Unknown interview client event.",
                code = "invalid_client_event",
            )
        }

        val event =
            log
                .atWarn()
                .addKeyValue("event", "interview_client_failure")
                .addKeyValue("event_type", request.event)
                .addKeyValue("session_id", sessionId)
                .addKeyValue("turn_index", request.turnIndex)
        request.durationMs?.let { event.addKeyValue("duration_ms", it) }
        event.log("Interview client reported a speech failure")
    }

    private companion object {
        val ALLOWED_EVENTS =
            setOf(
                "browser_speech_failed",
                "browser_speech_timed_out",
                "question_audio_poll_timed_out",
                "model_audio_play_rejected",
                "model_audio_error",
                "model_audio_stalled",
                "model_audio_timed_out",
            )
    }
}

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/client-events")
class InterviewTelemetryController(
    private val telemetry: InterviewTelemetryService,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun record(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable sessionId: UUID,
        @Valid @RequestBody request: InterviewClientEventRequest,
    ) {
        telemetry.record(SupabaseIdentity.from(jwt).id, sessionId, request)
    }
}
