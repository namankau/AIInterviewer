package com.interviewos.api.interview

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.common.ApiException
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * Builds and serves the feedback report (PRD §09).
 *
 * The one rule that matters here: **a competency score without a quote from the
 * candidate's own transcript is a badge, not feedback.** Scores whose evidence cannot be
 * found in the transcript are dropped rather than shown, because an invented quote is
 * worse than a missing score — it destroys the credibility the report exists to build.
 */
@Service
class ReportService(
    private val repository: SessionRepository,
    private val interviewAi: InterviewAi,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun report(
        userId: UUID,
        sessionId: UUID,
    ): Map<String, Any?> {
        repository.findReportJson(sessionId, userId)?.let {
            @Suppress("UNCHECKED_CAST")
            return objectMapper.readValue(it, Map::class.java) as Map<String, Any?>
        }

        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "completed") {
            throw ApiException.conflict(
                "This interview is not finished, so there is nothing to report yet.",
                code = "session_not_complete",
            )
        }

        val turns = repository.listTranscript(sessionId, userId).filter { it.answerTranscript != null }
        if (turns.isEmpty()) {
            throw ApiException.unprocessable(
                "This interview has no answers to assess.",
                code = "empty_transcript",
            )
        }

        val archetype = Archetype.fromDbValue(session.archetype)
        val roundType = RoundType.fromDbValue(session.roundType)
        val brief =
            InterviewBrief(
                company = session.companyName,
                archetype = archetype.label,
                role = session.roleTitle,
                roundType = "${roundType.label}. ${roundType.brief}",
                language = session.language,
                candidateFunction = null,
                candidateLevel = null,
                targetLevel = null,
                grounding = archetype.roundEmphasis,
            )

        // Counted from the turns, not asked of the model: this is what the candidate is
        // judged on, so the model does not get to be generous about it.
        val assistance = AssistanceSummary.of(turns)

        val composed =
            try {
                interviewAi.composeReport(
                    brief,
                    turns.map {
                        TurnTranscript(
                            questionText = it.questionText,
                            answerTranscript = it.answerTranscript,
                            intervention = Intervention.parse(it.intervention),
                            interventionNote = it.interventionNote,
                            // Marked so the model does not score "tell me about yourself"
                            // as though it were evidence of system-design ability.
                            warmUp = TurnPhase.fromDbValue(it.phase) == TurnPhase.WARMUP,
                            deliveryNote = it.deliveryNote,
                        )
                    },
                )
            } catch (e: AiUnavailableException) {
                log.warn("Report composition failed for session {}", sessionId, e)
                throw ApiException.upstreamUnavailable(
                    "Your interview is saved, but the report could not be generated just now. Try again shortly.",
                )
            }

        val verified = withVerifiedEvidence(composed.value, turns).withoutUnseenPresence(session.consentVideo)
        val payload = payloadOf(verified, session, roundType, archetype, turns.size, assistance)

        repository.saveReport(
            sessionId = sessionId,
            userId = userId,
            payloadJson = objectMapper.writeValueAsString(payload),
            model = composed.usage.model,
            promptTokens = composed.usage.promptTokens,
            outputTokens = composed.usage.outputTokens,
        )
        return payload
    }

    /**
     * Strips any claim about how the candidate looked when there was no camera. A model
     * asked about presence will describe some anyway, and a report that says a candidate
     * "maintained good eye contact" in an audio-only round is fabricated evidence — the
     * same failure as an invented quote, in a different costume.
     */
    private fun ReportContent.withoutUnseenPresence(hadVideo: Boolean): ReportContent =
        if (hadVideo || communication.presence == null) {
            this
        } else {
            copy(communication = communication.copy(presence = null))
        }

    /**
     * Drops any competency score whose evidence quote does not actually appear in the
     * transcript. Matching is loose on whitespace and case, because the model reflows
     * quotes, but it is not loose on content.
     */
    private fun withVerifiedEvidence(
        content: ReportContent,
        turns: List<TurnRow>,
    ): ReportContent {
        val haystack = turns.joinToString(" ") { it.answerTranscript.orEmpty() }.normaliseForMatch()
        val (kept, dropped) =
            content.competencies.partition { competency ->
                val quote = competency.evidenceQuote.normaliseForMatch()
                quote.isNotBlank() && haystack.contains(quote)
            }

        if (dropped.isNotEmpty()) {
            log.warn(
                "Dropped {} competency score(s) whose evidence was not in the transcript: {}",
                dropped.size,
                dropped.joinToString { it.competency },
            )
        }
        return content.copy(competencies = kept)
    }

    private fun payloadOf(
        content: ReportContent,
        session: SessionRow,
        roundType: RoundType,
        archetype: Archetype,
        answeredTurns: Int,
        assistance: AssistanceSummary,
    ): Map<String, Any?> =
        mapOf(
            "sessionId" to session.id.toString(),
            "companyName" to session.companyName,
            "roleTitle" to session.roleTitle,
            "roundType" to roundType.dbValue,
            "roundLabel" to roundType.label,
            "archetypeLabel" to archetype.label,
            "answeredTurns" to answeredTurns,
            "generatedAt" to
                java.time.Instant
                    .now()
                    .toString(),
            "headline" to content.headline,
            "summary" to content.summary,
            // Counts are computed from the turns; the narrative is the model's, written
            // against those counts. Both are shown, so the two cannot quietly diverge.
            "assistance" to
                mapOf(
                    "totalAnswers" to assistance.totalAnswers,
                    "unaidedAnswers" to assistance.unaidedAnswers,
                    "assistedAnswers" to assistance.assistedAnswers,
                    "headline" to assistance.headline,
                    "narrative" to content.assistedPerformance,
                    "breakdown" to
                        assistance.breakdown
                            .filterKeys { it.isAssisted }
                            .map { (intervention, count) ->
                                mapOf("label" to intervention.label, "count" to count)
                            },
                    "moments" to assistance.notes,
                ),
            "competencies" to
                content.competencies.map {
                    mapOf(
                        "competency" to it.competency,
                        "score" to it.score,
                        "maxScore" to it.maxScore,
                        "rationale" to it.rationale,
                        "evidenceQuote" to it.evidenceQuote,
                        "turnIndex" to it.turnIndex,
                    )
                },
            "annotations" to
                content.annotations.map {
                    mapOf(
                        "turnIndex" to it.turnIndex,
                        "question" to it.question,
                        "worked" to it.worked,
                        "vague" to it.vague,
                        "wouldProbe" to it.wouldProbe,
                        "strongerFraming" to it.strongerFraming,
                    )
                },
            "communication" to
                mapOf(
                    "structure" to content.communication.structure,
                    "fillerDensity" to content.communication.fillerDensity,
                    "pace" to content.communication.pace,
                    "rambling" to content.communication.rambling,
                    "handlingUncertainty" to content.communication.handlingUncertainty,
                    // Null unless the candidate had the camera on. The report never
                    // describes presence it did not see.
                    "presence" to content.communication.presence,
                ),
            "practicePlan" to
                content.practicePlan.map {
                    mapOf("focus" to it.focus, "why" to it.why, "drill" to it.drill)
                },
            "recommendedNextSession" to content.recommendedNextSession,
            "outcomeSimulation" to
                mapOf(
                    "label" to content.outcomeSimulation.label,
                    "likelihood" to content.outcomeSimulation.likelihood,
                    "reasoning" to content.outcomeSimulation.reasoning,
                ),
        )

    private companion object {
        val WHITESPACE = Regex("\\s+")

        fun String.normaliseForMatch(): String =
            lowercase()
                .replace("’", "'")
                .replace(Regex("[^a-z0-9' ]"), " ")
                .replace(WHITESPACE, " ")
                .trim()
    }
}
