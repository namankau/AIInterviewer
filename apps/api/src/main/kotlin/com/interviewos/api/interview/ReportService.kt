package com.interviewos.api.interview

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.ReportContent
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.common.ApiException
import com.interviewos.api.resume.ResumeService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
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
    private val retention: RetentionProperties,
    private val resumeService: ResumeService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun report(
        userId: UUID,
        sessionId: UUID,
        leaseId: UUID = UUID.randomUUID(),
    ): SessionReportView {
        repository.findReportJson(sessionId, userId)?.let {
            return storedReport(it)
        }

        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()

        // Checked before anything else about the round, and it is the reason retention
        // stamps the session instead of only deleting rows. Reaching this line means there
        // is no stored report; without the stamp, an expired round would be
        // indistinguishable from one nobody has opened yet, and the code below would
        // cheerfully compose a fresh report — a model call, producing a different report
        // from the one the candidate remembers, from a transcript that no longer exists.
        // Retention clears the turns as well, so in practice it would fail on
        // `empty_transcript` and tell them their interview had no answers in it. Neither
        // of those is an acceptable thing to say to somebody whose data we deleted on
        // purpose after telling them we would.
        if (session.reportExpiredAt != null) {
            throw ApiException.gone(
                "This report was kept for ${retention.days} days after the round and has now been deleted, " +
                    "along with the transcript and the recording. Nothing of it is recoverable.",
                code = "report_expired",
            )
        }

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
        // Derived the same way the round itself derived it, from the same two inputs, so
        // the report scores against the bar the interview was actually conducted at
        // (task 048). Until this existed the level reached the report as "unspecified",
        // and a prompt told to score "against what this function and level demands" was
        // given neither — so a final-year student was marked against nothing in
        // particular, which in practice means against a working engineer.
        val stage =
            CandidateStage.of(
                session.roleTitle,
                resumeService.backgroundFor(userId)?.tenure?.totalExperienceMonths,
                declaredStage = session.declaredStage,
            )
        val brief =
            InterviewBrief(
                company = session.companyName,
                archetype = archetype.label,
                role = session.roleTitle,
                roundType = "${roundType.label}. ${roundType.brief}",
                // What the round was meant to get across. The report reads it to judge
                // coverage — an interview that never left one topic is a fact about the
                // round, and the candidate should not be marked down for ground the
                // interviewer never took them to.
                roundCovers = stage.covers(roundType).joinToString("\n") { "- $it" },
                language = session.language,
                candidateFunction = null,
                candidateLevel = stage.candidateDescription,
                targetLevel = stage.targetDescription,
                levelCalibration = stage.reportCalibration(),
                grounding = archetype.roundEmphasis,
            )

        // Counted from the turns, not asked of the model: this is what the candidate is
        // judged on, so the model does not get to be generous about it.
        val assistance = AssistanceSummary.of(turns)

        val claim = repository.claimReportGeneration(sessionId, userId, leaseId, REPORT_LEASE_SECONDS)
        when (claim.status) {
            ReportGenerationClaimStatus.COMPLETED -> {
                return storedReport(checkNotNull(claim.payloadJson))
            }

            ReportGenerationClaimStatus.IN_PROGRESS -> {
                throw ApiException.conflict(
                    "This report is already being generated. Try again in a moment.",
                    code = "report_generating",
                )
            }

            ReportGenerationClaimStatus.UNAVAILABLE -> {
                throw ApiException.conflict(
                    "This report can no longer be generated from the current session state.",
                    code = "report_generation_unavailable",
                )
            }

            ReportGenerationClaimStatus.ACQUIRED -> {
                Unit
            }
        }

        var saved = false
        try {
            val composed =
                AiSpendContext.of(userId, sessionId) {
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
                                referencePoints = it.poolStrongAnswerCovers,
                            )
                        },
                    )
                }

            val verified =
                withVerifiedEvidence(composed.value, turns)
                    .withoutCameraClaims()
                    // Every answered question gets a note, whether or not the model wrote one
                    // for it (see AnswerAnnotations).
                    .let { it.copy(annotations = AnswerAnnotations.of(turns, it.annotations)) }
            val payload = payloadOf(verified, session, roundType, archetype, turns, assistance)

            if (!repository.saveReport(
                    sessionId = sessionId,
                    userId = userId,
                    leaseId = leaseId,
                    payloadJson = objectMapper.writeValueAsString(payload),
                    model = composed.usage.model,
                    promptTokens = composed.usage.promptTokens,
                    outputTokens = composed.usage.outputTokens,
                )
            ) {
                repository.findReportJson(sessionId, userId)?.let {
                    saved = true
                    return storedReport(it)
                }
                throw ApiException.conflict(
                    "The interview changed while its report was being generated. Refresh to see its current state.",
                    code = "report_generation_invalidated",
                )
            }
            saved = true
            return payload
        } catch (e: AiUnavailableException) {
            log.warn("Report composition failed for session {}", sessionId, e)
            throw ApiException.upstreamUnavailable(
                "Your interview is saved, but the report could not be generated just now. Try again shortly.",
            )
        } finally {
            if (!saved) {
                runCatching { repository.releaseReportGeneration(sessionId, userId, leaseId) }
                    .onFailure { log.warn("Could not release report generation lease {}", leaseId, it) }
            }
        }
    }

    /**
     * Fills in fields a stored report predates.
     *
     * Reports are composed once and kept, so a report written before strengths,
     * development areas or question provenance existed comes back without those keys and
     * the reader crashes on the first `.length`. That is exactly what happened: an
     * interview sat last week could not be opened at all after this week's release.
     *
     * Defaulting here rather than only in the browser means every client is fixed at
     * once, including the mobile apps that do not exist yet — and it keeps the shape of
     * the response a promise the API keeps rather than one each client has to re-check.
     */
    private fun storedReport(payloadJson: String): SessionReportView {
        @Suppress("UNCHECKED_CAST")
        val stored = objectMapper.readValue(payloadJson, Map::class.java) as Map<String, Any?>
        val complete = stored + EMPTY_SECTIONS.filterKeys { it !in stored }
        return objectMapper.readValue(objectMapper.writeValueAsString(complete), SessionReportView::class.java)
    }

    /**
     * Strips any claim about how the candidate looked when nothing looked at them. A model
     * asked about presence will describe some anyway, and a report that says a candidate
     * "maintained good eye contact" in an audio-only round is fabricated evidence — the
     * same failure as an invented quote, in a different costume.
     *
     * The camera is a local preview only, so nothing can honestly make a presence claim.
     */
    private fun ReportContent.withoutCameraClaims(): ReportContent =
        if (communication.presence == null) {
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
    ): SessionReportView =
        SessionReportView(
            sessionId = session.id,
            companyName = session.companyName,
            roleTitle = session.roleTitle,
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            archetypeLabel = archetype.label,
            answeredTurns = turns.size,
            generatedAt = java.time.Instant.now(),
            headline = content.headline,
            summary = content.summary,
            // Counts are computed from the turns; the narrative is the model's, written
            // against those counts. Both are shown, so the two cannot quietly diverge.
            assistance =
                ReportAssistanceView(
                    totalAnswers = assistance.totalAnswers,
                    unaidedAnswers = assistance.unaidedAnswers,
                    assistedAnswers = assistance.assistedAnswers,
                    headline = assistance.headline,
                    narrative = content.assistedPerformance,
                    breakdown =
                        assistance.breakdown
                            .filterKeys { it.isAssisted }
                            .map { (intervention, count) ->
                                ReportAssistanceBreakdownView(intervention.label, count)
                            },
                    moments = assistance.notes,
                ),
            competencies =
                content.competencies.map {
                    ReportCompetencyView(
                        competency = it.competency,
                        score = it.score,
                        maxScore = it.maxScore,
                        rationale = it.rationale,
                        evidenceQuote = it.evidenceQuote,
                        turnIndex = it.turnIndex,
                    )
                },
            annotations =
                content.annotations.map {
                    ReportAnnotationView(
                        turnIndex = it.turnIndex,
                        question = it.question,
                        worked = it.worked,
                        vague = it.vague,
                        wouldProbe = it.wouldProbe,
                        strongerFraming = it.strongerFraming,
                    )
                },
            communication =
                ReportCommunicationView(
                    structure = content.communication.structure,
                    fillerDensity = content.communication.fillerDensity,
                    pace = content.communication.pace,
                    rambling = content.communication.rambling,
                    handlingUncertainty = content.communication.handlingUncertainty,
                    // Null unless the candidate had the camera on. The report never
                    // describes presence it did not see.
                    presence = content.communication.presence,
                ),
            strengths = content.strengths.map { areaOf(it) },
            developmentAreas = content.developmentAreas.map { areaOf(it) },
            // Why each question was asked, taken from what was recorded when it was
            // composed rather than reconstructed now. Reconstructing it would mean asking
            // a model to recall its own reasoning, which is how invented citations happen.
            questionSources = questionSourcesOf(session, archetype, turns),
            practicePlan =
                content.practicePlan.map {
                    ReportPracticeItemView(it.focus, it.why, it.drill)
                },
            recommendedNextSession = content.recommendedNextSession,
            outcomeSimulation =
                ReportOutcomeView(
                    label = content.outcomeSimulation.label,
                    likelihood = content.outcomeSimulation.likelihood,
                    reasoning = content.outcomeSimulation.reasoning,
                ),
        )

    private fun areaOf(area: com.interviewos.api.ai.AssessedArea): ReportAssessedAreaView =
        ReportAssessedAreaView(
            area = area.area,
            evidenceQuote = area.evidenceQuote,
            turnIndex = area.turnIndex,
            whyItMatters = area.whyItMatters,
            whatToDo = area.whatToDo,
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
     * **The confidence line is the truth, not a hedge.** Only a turn that asked a question
     * from the bank carries `sources`, and the header counts those turns rather than
     * describing the round as sourced — and, when there are none, says the questions are
     * archetype patterns and whether we even recognised the employer. A candidate who reads
     * "asked at Google in March" and finds nothing behind it never trusts the report
     * again, and they would be right.
     */
    private fun questionSourcesOf(
        session: SessionRow,
        archetype: Archetype,
        turns: List<TurnRow>,
    ): ReportQuestionSourcesView {
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

                ReportQuestionSourceView(
                    turnIndex = turn.turnIndex,
                    question = turn.questionText,
                    phase = turn.phase,
                    probes = provenance.probes,
                    askedBecause = provenance.askedBecause,
                    basis = provenance.basis,
                    tier = provenance.tier.dbValue,
                    // A pool question's own label replaces the tier's general sentence: it is
                    // the one thing the report says about where that question came from.
                    tierDisclosure = provenance.label ?: provenance.tier.disclosure,
                    sources =
                        provenance.sources.map {
                            ReportProvenanceSourceView(
                                title = it.title,
                                publisher = it.publisher,
                                url = it.url,
                                year = it.year,
                            )
                        },
                )
            }

        val recognised = Confidence.entries.firstOrNull { it.dbValue == session.archetypeConfidence } == Confidence.RECOGNISED
        // Counted from the tiers recorded per turn, which the engine set when each question
        // was asked. A round with bank questions in it is still mostly follow-ups, and the
        // header has to say which is which rather than lend the whole round the citations.
        val sourced = entries.count { it.tier == ProvenanceTier.PUBLISHED_SOURCE.dbValue }
        val company = session.companyName
        val headline =
            when {
                sourced > 0 -> {
                    val which = if (sourced == 1) "One of these questions was" else "$sourced of these questions were"
                    "$which reported for $company by sources we hold, and each is cited beneath it. The rest " +
                        "were written for this round from your answers and from how ${archetype.inProse} interviews."
                }

                recognised -> {
                    "These questions were composed for ${archetype.inProse}, ${session.roleTitle}, from " +
                        "general knowledge of how that kind of employer interviews."
                }

                else -> {
                    "We do not have specific information about $company, so these questions " +
                        "were composed from the general patterns of ${archetype.inProse}."
                }
            }
        // Said plainly, and said even though it is unflattering. It is the difference
        // between a citation and a claim.
        val disclosure =
            if (sourced > 0) {
                "Only a question with a citation under it is one a source reports $company asking. " +
                    "Follow-ups and anything else we wrote are labelled as general knowledge, because that " +
                    "is what they are."
            } else {
                "None of these are sourced reports of questions $company has actually asked. We held no " +
                    "reported questions to ask you in this round, and we would rather tell you that than " +
                    "show you a citation we cannot stand behind."
            }
        return ReportQuestionSourcesView(
            entries = entries,
            employerRecognised = recognised,
            archetypeLabel = archetype.label,
            headline = headline,
            disclosure = disclosure,
        )
    }

    private companion object {
        const val REPORT_LEASE_SECONDS = 10 * 60L

        /**
         * What an older stored report is missing, and what it should read as instead.
         *
         * An empty section renders as nothing, which is the honest answer: that report
         * genuinely has no strengths list, because nothing analysed one at the time.
         */
        val EMPTY_SECTIONS: Map<String, Any?> =
            mapOf(
                "strengths" to emptyList<Any>(),
                "developmentAreas" to emptyList<Any>(),
                "questionSources" to
                    mapOf(
                        "entries" to emptyList<Any>(),
                        "employerRecognised" to false,
                        "archetypeLabel" to "",
                        "headline" to "",
                        "disclosure" to "",
                    ),
            )

        val WHITESPACE = Regex("\\s+")

        fun String.normaliseForMatch(): String =
            lowercase()
                .replace("’", "'")
                .replace(Regex("[^a-z0-9' ]"), " ")
                .replace(WHITESPACE, " ")
                .trim()
    }
}
