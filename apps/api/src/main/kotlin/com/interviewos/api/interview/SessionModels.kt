package com.interviewos.api.interview

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

/**
 * Request and response shapes for the interview loop. The web app and, in Phase 3, the
 * mobile apps consume these unchanged.
 */

data class StartSessionRequest(
    @field:NotBlank(message = "Name the company you are interviewing with.")
    @field:Size(max = 120)
    val companyName: String = "",
    @field:NotBlank(message = "Name the role you are interviewing for.")
    @field:Size(max = 120)
    val roleTitle: String = "",
    @field:NotBlank
    val roundType: String = "",
    val language: String = "english",
    /**
     * Consent is a hard gate and is recorded per stream, with a timestamp. The server
     * refuses to start a session without audio consent, because the interview is spoken.
     */
    val consentAudio: Boolean = false,
    val consentVideo: Boolean = false,
)

/** One exchange as the client needs to render it. */
data class TurnView(
    val turnIndex: Int,
    val questionText: String,
    /** Short-lived signed URL for the spoken question. Null if speech was unavailable. */
    val questionAudioUrl: String?,
    val answered: Boolean,
)

data class SessionView(
    val id: UUID,
    val companyName: String,
    val archetype: String,
    val archetypeLabel: String,
    /** `recognised` or `inferred`. The UI must say when it is inferred. */
    val archetypeConfidence: String,
    /**
     * Plain-language provenance for the candidate. Never claims knowledge of a specific
     * employer's process — see PRD §04.
     */
    val groundingNote: String,
    val roleTitle: String,
    val roundType: String,
    val roundLabel: String,
    val language: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val turnsCompleted: Int,
    val maxTurns: Int,
    val currentTurn: TurnView?,
)

data class SubmitAnswerResponse(
    val sessionComplete: Boolean,
    val turnsCompleted: Int,
    val nextTurn: TurnView?,
)

/** Whether the candidate may start another interview, and why not if not. */
data class EntitlementView(
    val allowed: Boolean,
    val reason: String,
    val message: String,
    val remainingFree: Int,
)

data class SessionSummary(
    val id: UUID,
    val companyName: String,
    val roleTitle: String,
    val roundType: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val hasReport: Boolean,
)

/**
 * Readiness for one (company, role), derived by grouping completed sessions after the
 * fact. There is no stored target list — see PRD §05.
 */
data class ReadinessGroup(
    val companyName: String,
    val roleTitle: String,
    val sessionsCompleted: Int,
    val firstAttemptAt: Instant?,
    val latestAttemptAt: Instant?,
    val latestAverageScore: Double?,
    val firstAverageScore: Double?,
    val recurringWeaknesses: List<String>,
)
