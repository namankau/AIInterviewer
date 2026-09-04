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
        val payload = payloadOf(verified, session, roundType, archetype, turns, assistance)

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

        fun grounded(quote: String): Boolean {
            val normalised = quote.normaliseForMatch()
            return normalised.isNotBlank() && haystack.contains(normalised)
        }

        val (kept, dropped) = content.competencies.partition { grounded(it.evidenceQuote) }
        if (dropped.isNotEmpty()) {
            log.warn(
                "Dropped {} competency score(s) whose evidence was not in the transcript: {}",
                dropped.size,
                dropped.joinToString { it.competency },
            )
        }

        // Strengths and development areas quote the candidate too, so they answer to the
        // same rule. An invented quote is no less invented for sitting under a friendlier
        // heading.
        val (keptStrengths, droppedStrengths) = content.strengths.partition { grounded(it.evidenceQuote) }
        val (keptAreas, droppedAreas) = content.developmentAreas.partition { grounded(it.evidenceQuote) }
        if (droppedStrengths.isNotEmpty() || droppedAreas.isNotEmpty()) {
            log.warn(
                "Dropped {} strength(s) and {} development area(s) whose evidence was not in the transcript",
                droppedStrengths.size,
                droppedAreas.size,
            )
        }

        return content.copy(
            competencies = kept,
            strengths = keptStrengths,
            developmentAreas = keptAreas,
        )
    }

    private fun payloadOf(
        content: ReportContent,
        session: SessionRow,
        roundType: RoundType,
        archetype: Archetype,
        turns: List<TurnRow>,
        assistance: AssistanceSummary,
    ): Map<String, Any?> =
        mapOf(
            "sessionId" to session.id.toString(),
            "companyName" to session.companyName,
            "roleTitle" to session.roleTitle,
            "roundType" to roundType.dbValue,
            "roundLabel" to roundType.label,
            "archetypeLabel" to archetype.label,
            "answeredTurns" to turns.size,
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
            "strengths" to content.strengths.map { areaOf(it) },
            "developmentAreas" to content.developmentAreas.map { areaOf(it) },
            // Why each question was asked, taken from what was recorded when it was
            // composed rather than reconstructed now. Reconstructing it would mean asking
            // a model to recall its own reasoning, which is how invented citations happen.
            "questionSources" to questionSourcesOf(session, archetype, turns),
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

    private fun areaOf(area: com.interviewos.api.ai.AssessedArea): Map<String, Any?> =
        mapOf(
            "area" to area.area,
            "evidenceQuote" to area.evidenceQuote,
            "turnIndex" to area.turnIndex,
            "whyItMatters" to area.whyItMatters,
            "whatToDo" to area.whatToDo,
        )

    /**
     * Where the round's questions came from.
     *
     * This is the section the product is betting on: a candidate should be able to see
     * what each question was testing and why they, specifically, got it. Two rules keep
     * it worth reading.
     *
     * **Nothing is invented at report time.** Each entry is the provenance recorded when
     * the question was composed. A turn with none recorded is simply absent rather than
     * reconstructed.
     *
     * **The confidence line is the truth, not a hedge.** `sources` is empty on every
     * question today because there is no retrieval corpus, so the header says the
     * questions are archetype patterns rather than sourced reports of this employer's
     * process — and says whether we even recognised the employer. A candidate who reads
     * "asked at Google in March" and finds nothing behind it never trusts the report
     * again, and they would be right.
     */
    private fun questionSourcesOf(
        session: SessionRow,
        archetype: Archetype,
        turns: List<TurnRow>,
    ): Map<String, Any?> {
        val entries =
            turns.mapNotNull { turn ->
                val provenance =
                    turn.provenanceJson?.let {
                        try {
                            objectMapper.readValue(it, QuestionProvenance::class.java)
                        } catch (e: RuntimeException) {
                            log.warn("Unreadable provenance on turn {}", turn.turnIndex, e)
                            null
                        }
                    } ?: return@mapNotNull null

                mapOf(
                    "turnIndex" to turn.turnIndex,
                    "question" to turn.questionText,
                    "phase" to turn.phase,
                    "probes" to provenance.probes,
                    "askedBecause" to provenance.askedBecause,
                    "basis" to provenance.basis,
                    "tier" to provenance.tier.dbValue,
                    "tierDisclosure" to provenance.tier.disclosure,
                    "sources" to
                        provenance.sources.map {
                            mapOf(
                                "title" to it.title,
                                "publisher" to it.publisher,
                                "url" to it.url,
                                "year" to it.year,
                            )
                        },
                )
            }

        val recognised = Confidence.entries.firstOrNull { it.dbValue == session.archetypeConfidence } == Confidence.RECOGNISED
        return mapOf(
            "entries" to entries,
            "employerRecognised" to recognised,
            "archetypeLabel" to archetype.label,
            "headline" to
                if (recognised) {
                    "These questions were composed for ${archetype.inProse}, ${session.roleTitle}, from " +
                        "general knowledge of how that kind of employer interviews."
                } else {
                    "We do not have specific information about ${session.companyName}, so these questions " +
                        "were composed from the general patterns of ${archetype.inProse}."
                },
            // Said plainly, and said even though it is unflattering. It is the difference
            // between a citation and a claim.
            "disclosure" to
                "None of these are sourced reports of questions ${session.companyName} has actually asked. " +
                "We do not have a corpus of real interview reports yet, and we would rather tell you that " +
                "than show you a citation we cannot stand behind.",
        )
    }

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
