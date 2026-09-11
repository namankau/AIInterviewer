package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import jakarta.validation.Valid
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
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import tools.jackson.databind.JsonNode
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
    private val roundDeletion: RoundDeletion,
) {
    @GetMapping("/entitlement")
    fun entitlement(
        @AuthenticationPrincipal jwt: Jwt,
    ): EntitlementView = interviewService.entitlement(callerOf(jwt))

    @GetMapping("/sessions")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<SessionSummary> = interviewService.list(callerOf(jwt))

    /**
     * Reads one line of intent into a draft round. Creates nothing — the candidate
     * corrects it and starts the session through `POST /sessions` like anyone else.
     */
    @PostMapping("/round-drafts")
    fun composeRound(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: ComposeRoundRequest,
    ): RoundDraft {
        callerOf(jwt)
        return interviewService.composeRound(request)
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    fun start(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody request: StartSessionRequest,
    ): SessionView = interviewService.start(SupabaseIdentity.from(jwt), request)

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
        // See StartSessionRequest.speaksLocally. Sent per turn because it describes the
        // browser answering this turn, not the session.
        @RequestParam(required = false, defaultValue = "false") speaksLocally: Boolean,
        // Submit pressed mid-answer: assess this one as the last and end the round.
        @RequestParam(required = false, defaultValue = "false") endRound: Boolean,
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
            speaksLocally = speaksLocally,
            endRound = endRound,
        )
    }

    /**
     * Ends the round now and completes it, so the report is written from what has been
     * answered. Distinct from `abandon`, which forfeits the round and produces no report.
     */
    @PostMapping("/sessions/{id}/finish")
    fun finish(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ): SubmitAnswerResponse = interviewService.finish(callerOf(jwt), id)

    /**
     * One question, so the room can collect the interviewer's voice once it has
     * rendered. The question text itself arrived with the previous response.
     */
    @GetMapping("/sessions/{id}/turns/{turnIndex}")
    fun turn(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @PathVariable turnIndex: Int,
    ): TurnView = interviewService.turn(callerOf(jwt), id, turnIndex)

    /**
     * Help, asked for rather than offered. One per question, and recorded — the round
     * would not be worth much if a candidate could quietly farm hints out of it.
     */
    @PostMapping("/sessions/{id}/turns/{turnIndex}/hint")
    fun hint(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @PathVariable turnIndex: Int,
    ): HintView = interviewService.requestHint(callerOf(jwt), id, turnIndex)

    @PostMapping("/sessions/{id}/abandon")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun abandon(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) = interviewService.abandon(callerOf(jwt), id)

    /**
     * Deletes one of the caller's own rounds, and everything under it: the turns, the
     * report, and the recordings in storage.
     *
     * Irreversible, and there is no soft-delete behind it. A candidate asking for their
     * interview to be destroyed is entitled to have it destroyed rather than hidden, and a
     * row marked `deleted = true` is not a deletion — it is the same personal data with a
     * flag on it. The confirmation that this is what they meant belongs in the client,
     * before the request is sent.
     *
     * Like every other route here, the owner comes from the verified token. A session
     * belonging to somebody else is a 404.
     */
    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) = roundDeletion.delete(callerOf(jwt), id)

    /**
     * Runs the candidate's code against one input and hands back what it printed.
     *
     * Scoped to a session the caller owns, because that is what makes it theirs to run —
     * without it this is an open code-execution endpoint on the public internet.
     *
     * Never fails the request when the runner does. A busy or absent runner comes back as
     * a result saying so, and the round carries on out loud, which is what the candidate
     * is assessed on anyway.
     */
    @PostMapping("/sessions/{id}/run")
    fun runCode(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @Valid @RequestBody request: RunCodeRequest,
    ): CodeRunResult = interviewService.runCode(callerOf(jwt), id, request)

    /**
     * Stores what the candidate has on the board — the design they drew, or the code they
     * wrote — so a reload does not lose it (PRD 06).
     */
    @PutMapping("/sessions/{id}/board")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun saveBoard(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @RequestBody board: JsonNode,
    ) = interviewService.saveBoard(callerOf(jwt), id, board)

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
