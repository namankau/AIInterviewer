package com.interviewos.api.interview

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * Conducts an interview.
 *
 * All of the decision-making lives here, server-side: whether a session may start, what
 * is asked next, when it ends, and what the report says. The client captures media and
 * renders — it never chooses a question or computes a score (CLAUDE.md).
 *
 * When Gemini is unavailable the session is marked `failed` and the candidate is told.
 * It never silently degrades to canned questions and presents the result as a real
 * assessment (task 002, §5).
 */
@Service
class InterviewService(
    private val repository: SessionRepository,
    private val archetypeResolver: ArchetypeResolver,
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun entitlement(userId: UUID): EntitlementView {
        val decision =
            Entitlement.evaluate(
                completedSessions = repository.countCompletedSessions(userId),
                paidSessionCredits = repository.countPaidSessionCredits(userId),
                sessionInProgress = repository.findOpenSessionId(userId) != null,
            )
        return EntitlementView(
            allowed = decision.allowed,
            reason = decision.reason.name.lowercase(),
            message = decision.message,
            remainingFree = decision.remainingFree,
        )
    }

    @Transactional
    fun start(
        userId: UUID,
        request: StartSessionRequest,
    ): SessionView {
        if (!request.consentAudio) {
            throw ApiException.badRequest(
                "The interview is spoken, so recording your voice is required. Nothing is captured without your consent.",
                code = "consent_required",
            )
        }

        val roundType =
            RoundType.parseOrNull(request.roundType)
                ?: throw ApiException.badRequest("That is not a round type we run.", code = "unknown_round_type")

        val decision =
            Entitlement.evaluate(
                completedSessions = repository.countCompletedSessions(userId),
                paidSessionCredits = repository.countPaidSessionCredits(userId),
                sessionInProgress = repository.findOpenSessionId(userId) != null,
            )
        if (!decision.allowed) {
            throw when (decision.reason) {
                Entitlement.Reason.FREE_TIER_EXHAUSTED -> ApiException.paymentRequired(decision.message)
                else -> ApiException.conflict(decision.message, code = "session_in_progress")
            }
        }

        val resolution = archetypeResolver.resolve(request.companyName)
        val sessionId =
            repository.insertSession(
                userId = userId,
                companyName = request.companyName.trim(),
                archetype = resolution.archetype,
                confidence = resolution.confidence,
                roleTitle = request.roleTitle.trim(),
                roundType = roundType.dbValue,
                language = request.language,
                consentAudio = request.consentAudio,
                consentVideo = request.consentVideo,
            )

        val brief = briefFor(request.companyName.trim(), resolution, request.roleTitle.trim(), roundType, request.language)
        val opening =
            try {
                interviewAi.composeOpeningQuestion(brief)
            } catch (e: AiUnavailableException) {
                repository.markSessionStatus(sessionId, userId, "failed")
                log.warn("Opening question failed for session {}", sessionId, e)
                throw ApiException.upstreamUnavailable(
                    "The interviewer could not be reached just now. Nothing was charged — please try again.",
                )
            }

        val audioPath = speakAndStore(userId, sessionId, turnIndex = 0, text = opening.value.text, language = request.language)
        repository.insertTurn(sessionId, userId, 0, opening.value.text, audioPath)

        return view(userId, sessionId)
    }

    @Transactional
    fun submitAnswer(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        audio: AnswerAudio,
        video: ByteArray?,
        videoContentType: String?,
    ): SubmitAnswerResponse {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "in_progress") {
            throw ApiException.conflict("This interview is no longer running.", code = "session_not_running")
        }

        val turn =
            repository.findTurn(sessionId, userId, turnIndex)
                ?: throw ApiException.notFound("That question is not part of this interview.")
        if (turn.answeredAt != null) {
            throw ApiException.conflict("That question has already been answered.", code = "already_answered")
        }

        val answerPath = store(userId, sessionId, "turn-$turnIndex-answer", audio.bytes, audio.contentType)
        val videoPath =
            video?.let { store(userId, sessionId, "turn-$turnIndex-video", it, videoContentType ?: "video/webm") }

        val roundType = RoundType.fromDbValue(session.roundType)
        val resolution =
            ArchetypeResolution(Archetype.fromDbValue(session.archetype), confidenceOf(session.archetypeConfidence))
        val brief = briefFor(session.companyName, resolution, session.roleTitle, roundType, session.language)
        val priorTurns =
            repository
                .listTranscript(sessionId, userId)
                .filter { it.turnIndex < turnIndex && it.answerTranscript != null }
                .map { TurnTranscript(it.questionText, it.answerTranscript) }

        val assessment =
            try {
                interviewAi.assessAnswer(brief, priorTurns, turn.questionText, audio)
            } catch (e: AiUnavailableException) {
                repository.markSessionStatus(sessionId, userId, "failed")
                log.warn("Answer assessment failed for session {} turn {}", sessionId, turnIndex, e)
                throw ApiException.upstreamUnavailable(
                    "We could not process that answer. The interview has been stopped rather than scored unfairly.",
                )
            }

        val nextAction = normaliseAction(assessment.value.suggestedNextAction)
        val intervention = Intervention.parse(assessment.value.intervention)
        repository.recordAnswer(
            sessionId = sessionId,
            userId = userId,
            turnIndex = turnIndex,
            transcript = assessment.value.transcript,
            audioPath = answerPath,
            videoPath = videoPath,
            assessmentJson = objectMapper.writeValueAsString(assessment.value),
            nextAction = nextAction,
            intervention = intervention.wireValue,
            // Only keep a note when help was actually given, so the report cannot
            // report assistance that did not happen.
            interventionNote = assessment.value.interventionNote?.takeIf { intervention.isAssisted },
        )

        val answered = repository.countAnsweredTurns(sessionId, userId)
        val shouldConclude = nextAction == "conclude" || answered >= MAX_TURNS
        if (shouldConclude) {
            repository.markSessionStatus(sessionId, userId, "completed")
            return SubmitAnswerResponse(sessionComplete = true, turnsCompleted = answered, nextTurn = null)
        }

        val nextText = assessment.value.nextQuestionText?.takeIf { it.isNotBlank() }
        if (nextText == null) {
            repository.markSessionStatus(sessionId, userId, "completed")
            return SubmitAnswerResponse(sessionComplete = true, turnsCompleted = answered, nextTurn = null)
        }

        val nextIndex = turnIndex + 1
        val nextAudioPath = speakAndStore(userId, sessionId, nextIndex, nextText, session.language)
        repository.insertTurn(sessionId, userId, nextIndex, nextText, nextAudioPath)

        return SubmitAnswerResponse(
            sessionComplete = false,
            turnsCompleted = answered,
            nextTurn = TurnView(nextIndex, nextText, signedUrl(nextAudioPath), answered = false),
        )
    }

    fun abandon(
        userId: UUID,
        sessionId: UUID,
    ) {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status == "in_progress") {
            repository.markSessionStatus(sessionId, userId, "abandoned")
        }
    }

    fun view(
        userId: UUID,
        sessionId: UUID,
    ): SessionView {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val latest = repository.findLatestTurn(sessionId, userId)
        val archetype = Archetype.fromDbValue(session.archetype)
        val confidence = confidenceOf(session.archetypeConfidence)
        val roundType = RoundType.fromDbValue(session.roundType)

        return SessionView(
            id = session.id,
            companyName = session.companyName,
            archetype = archetype.dbValue,
            archetypeLabel = archetype.label,
            archetypeConfidence = confidence.dbValue,
            groundingNote = candidateFacingNote(session.companyName, archetype, confidence),
            roleTitle = session.roleTitle,
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            language = session.language,
            status = session.status,
            startedAt = session.startedAt,
            endedAt = session.endedAt,
            turnsCompleted = repository.countAnsweredTurns(sessionId, userId),
            maxTurns = MAX_TURNS,
            currentTurn =
                latest
                    ?.takeIf { it.answeredAt == null }
                    ?.let { TurnView(it.turnIndex, it.questionText, signedUrl(it.questionAudioPath), answered = false) },
        )
    }

    fun list(userId: UUID): List<SessionSummary> = repository.listSessions(userId)

    /**
     * What the candidate is told about grounding. Deliberately plain: an inferred
     * archetype is described as a general pattern, never as knowledge of that employer.
     */
    private fun candidateFacingNote(
        company: String,
        archetype: Archetype,
        confidence: Confidence,
    ): String =
        when (confidence) {
            Confidence.RECOGNISED -> {
                "Run as a ${archetype.label.lowercase()} loop. These are general patterns for that kind of " +
                    "employer, not a description of $company's current process."
            }

            Confidence.INFERRED -> {
                "We do not have specific information about $company, so this runs on general " +
                    "${archetype.label.lowercase()} patterns."
            }
        }

    private fun briefFor(
        company: String,
        resolution: ArchetypeResolution,
        role: String,
        roundType: RoundType,
        language: String,
    ) = InterviewBrief(
        company = company,
        archetype = resolution.archetype.label,
        role = role,
        roundType = "${roundType.label}. ${roundType.brief}",
        language = language,
        candidateFunction = null,
        candidateLevel = null,
        targetLevel = null,
        grounding = resolution.grounding,
    )

    /** Speech is a nicety — a failure here degrades to a written question, not a dead session. */
    private fun speakAndStore(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        text: String,
        language: String,
    ): String? =
        try {
            val spoken = interviewAi.synthesizeSpeech(text, language)
            store(userId, sessionId, "turn-$turnIndex-question", spoken.value.audio, spoken.value.mimeType)
        } catch (e: AiUnavailableException) {
            log.warn("Speech unavailable for session {} turn {}; falling back to text", sessionId, turnIndex, e)
            null
        } catch (e: ObjectStorageException) {
            log.warn("Could not store question audio for session {} turn {}", sessionId, turnIndex, e)
            null
        }

    private fun store(
        userId: UUID,
        sessionId: UUID,
        name: String,
        bytes: ByteArray,
        contentType: String,
    ): String {
        // Ownership is the first path segment, matching the storage RLS policies.
        val path = "$userId/$sessionId/$name.${extensionFor(contentType)}"
        storage.upload(storageProperties.mediaBucket, path, bytes, contentType)
        return path
    }

    private fun signedUrl(path: String?): String? =
        path?.let {
            try {
                storage.createSignedUrl(storageProperties.mediaBucket, it, SIGNED_URL_SECONDS)
            } catch (e: ObjectStorageException) {
                log.warn("Could not sign URL for {}", it, e)
                null
            }
        }

    private fun confidenceOf(value: String): Confidence = Confidence.entries.firstOrNull { it.dbValue == value } ?: Confidence.INFERRED

    /** The model's suggestion is advisory; the engine owns what actually happens next. */
    private fun normaliseAction(suggested: String): String = suggested.lowercase().trim().takeIf { it in ALLOWED_ACTIONS } ?: "move_on"

    private fun extensionFor(contentType: String): String =
        when {
            contentType.contains("webm") -> "webm"
            contentType.contains("mp4") -> "mp4"
            contentType.contains("ogg") -> "ogg"
            contentType.contains("wav") || contentType.contains("L16") -> "wav"
            contentType.contains("mpeg") || contentType.contains("mp3") -> "mp3"
            else -> "bin"
        }

    private companion object {
        /** Keeps a session bounded, and keeps per-session model cost predictable. */
        const val MAX_TURNS = 8
        const val SIGNED_URL_SECONDS = 3600
        val ALLOWED_ACTIONS =
            setOf(
                "follow_up",
                "probe",
                "challenge",
                "move_on",
                "raise_difficulty",
                "redirect",
                "hint",
                "guide",
                "conclude",
            )
    }
}
