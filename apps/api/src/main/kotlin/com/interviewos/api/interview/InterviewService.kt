package com.interviewos.api.interview

import com.interviewos.api.ai.AiSpendContext
import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.ai.AskedQuestion
import com.interviewos.api.ai.Intervention
import com.interviewos.api.ai.InterviewAi
import com.interviewos.api.ai.InterviewBrief
import com.interviewos.api.ai.PlannedQuestion
import com.interviewos.api.ai.RoundContext
import com.interviewos.api.ai.TurnTranscript
import com.interviewos.api.bank.BankQuestion
import com.interviewos.api.common.ApiException
import com.interviewos.api.resume.CandidateBackground
import com.interviewos.api.resume.ResumeService
import com.interviewos.api.resume.ResumeUse
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.ObjectStorageException
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture

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
    private val userRepository: UserRepository,
    private val archetypeResolver: ArchetypeResolver,
    private val interviewAi: InterviewAi,
    private val storage: ObjectStorage,
    private val storageProperties: StorageProperties,
    private val objectMapper: ObjectMapper,
    private val questionSpeech: QuestionSpeech,
    private val entitlementProperties: EntitlementProperties,
    private val retentionProperties: RetentionProperties,
    private val roundMedia: RoundMediaProperties,
    private val bankRounds: BankRoundPlanner,
    private val poolRounds: PoolRoundPlanner,
    private val resumeService: ResumeService,
    private val roundWorkspaceComposer: RoundWorkspaceComposer,
    private val codeRunner: CodeRunner,
    transactionManager: PlatformTransactionManager,
    @Qualifier("interviewBackgroundExecutor") private val backgroundExecutor: TaskExecutor,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    fun entitlement(userId: UUID): EntitlementView {
        val decision =
            Entitlement.evaluate(
                completedSessions = repository.countCompletedSessions(userId),
                paidSessionCredits = repository.countPaidSessionCredits(userId),
                sessionInProgress = repository.findOpenSessionId(userId) != null,
                freeRounds = entitlementProperties.freeRounds,
            )
        return EntitlementView(
            allowed = decision.allowed,
            reason = decision.reason.name.lowercase(),
            message = decision.message,
            remainingFree = decision.remainingFree,
        )
    }

    /**
     * Reads one line of intent into a draft round, and says what it had to assume.
     *
     * Nothing is created here. The draft goes back to the candidate to correct, and the
     * session is started through the normal path — so the composer is a faster way into
     * the same setup rather than a second way to create a session with its own rules.
     *
     * The employer read out of the sentence is resolved to an archetype here rather than
     * in the model, so the candidate learns *before* the round whether we actually
     * recognise where they are interviewing. A model that both guessed the company and
     * described its process would be inventing the one thing we must never invent.
     */
    fun composeRound(request: ComposeRoundRequest): RoundDraft {
        val composed =
            try {
                interviewAi.composeRound(request.query.trim()).value
            } catch (e: AiUnavailableException) {
                log.warn("Could not compose a round from a candidate's query", e)
                throw ApiException.upstreamUnavailable(
                    "We could not read that just now. Fill the round in yourself and it will start the same way.",
                )
            }

        val company = composed.company.trim().take(120)
        val roundType = RoundType.parseOrNull(composed.roundType) ?: RoundType.PROJECT_DEEP_DIVE
        val resolution = archetypeResolver.resolve(company)
        val duration = composed.durationMinutes?.coerceIn(MIN_ROUND_MINUTES, MAX_ROUND_MINUTES) ?: DEFAULT_ROUND_MINUTES

        return RoundDraft(
            companyName = company,
            roleTitle = composed.role.trim().take(120),
            level = composed.level.trim().take(60),
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            durationMinutes = duration,
            language = if (composed.language == "hindi_english") "hindi_english" else "english",
            understood = composed.understood.trim(),
            assumptions = composed.assumptions.map { it.trim() }.filter { it.isNotBlank() },
            confidence = composed.confidence.lowercase().takeIf { it in DRAFT_CONFIDENCES } ?: "low",
            archetypeLabel = resolution.archetype.label,
            archetypeConfidence = resolution.confidence.dbValue,
            groundingNote =
                if (company.isBlank()) {
                    "You have not named an employer, so this runs on general patterns for the round type. " +
                        "Name one and the round is shaped to that kind of employer instead."
                } else {
                    candidateFacingNote(
                        company,
                        resolution.archetype,
                        resolution.confidence,
                        roundType,
                        bankRounds.questionCount(company, roundType),
                    )
                },
        )
    }

    /**
     * Starts a round.
     *
     * **Deliberately not one transaction.** It used to be, and that made setup take three
     * to five minutes. `provision()` upserts the user row, and because `users.email` is
     * unique and appears in the upsert's SET list, Postgres locks that row FOR UPDATE —
     * held until the transaction commits. The transaction then made a Gemini call, and
     * every model call records its cost through `AiSpendRepository`, which runs
     * REQUIRES_NEW: a second connection, on the same thread, inserting an `ai_calls` row
     * whose foreign key needs FOR KEY SHARE on that same user row. The inner write waited
     * for the outer transaction; the outer transaction waited for its own thread. Postgres
     * cannot see that as a deadlock, so it sat there until `statement_timeout` fired, the
     * ledger write was swallowed, and the round finally opened.
     *
     * It was also why `composeOpeningQuestion` never appeared in the ledger at all.
     *
     * So: the rows that must exist together are written in one short transaction, the
     * model is called with no transaction open, and what it produced is written in a
     * second. A slow model call now costs the candidate the model's time and nothing more,
     * and it never holds a database connection while it waits.
     */
    fun start(
        identity: SupabaseIdentity,
        request: StartSessionRequest,
    ): SessionView {
        val userId = identity.id

        if (!request.consentAudio) {
            throw ApiException.badRequest(
                "The interview is spoken, so recording your voice is required. Nothing is captured without your consent.",
                code = "consent_required",
            )
        }

        val roundType =
            RoundType.parseOrNull(request.roundType)
                ?: throw ApiException.badRequest("That is not a round type we run.", code = "unknown_round_type")

        val resolution = archetypeResolver.resolve(request.companyName)
        val sessionId =
            inTransaction {
                // Provisioning used to be a side effect of GET /me, so starting an interview
                // before that endpoint had ever been called failed on the users foreign key.
                // Any entry point that creates user-owned rows has to stand on its own.
                userRepository.provision(identity)
                admitAndInsert(userId, request, roundType, resolution)
            }

        // The session row has committed, so a failure from here on can no longer be rolled
        // back — it has to be recorded. Without this a round that died mid-setup would sit
        // `in_progress` with no question in it, and block the candidate's next start.
        return try {
            composeAndOpen(userId, sessionId, request, roundType, resolution)
        } catch (e: RuntimeException) {
            runCatching { repository.markSessionStatus(sessionId, userId, "failed") }
            throw e
        }
    }

    /**
     * The entitlement check and the session row, together.
     *
     * These have to share a transaction: two starts racing for the same candidate would
     * otherwise both see "no round in progress" and both create one.
     */
    private fun admitAndInsert(
        userId: UUID,
        request: StartSessionRequest,
        roundType: RoundType,
        resolution: ArchetypeResolution,
    ): UUID {
        val decision =
            Entitlement.evaluate(
                completedSessions = repository.countCompletedSessions(userId),
                paidSessionCredits = repository.countPaidSessionCredits(userId),
                sessionInProgress = repository.findOpenSessionId(userId) != null,
                freeRounds = entitlementProperties.freeRounds,
            )
        if (!decision.allowed) {
            throw when (decision.reason) {
                Entitlement.Reason.FREE_TIER_EXHAUSTED -> ApiException.paymentRequired(decision.message)
                else -> ApiException.conflict(decision.message, code = "session_in_progress")
            }
        }

        return repository.insertSession(
            userId = userId,
            companyName = request.companyName.trim(),
            archetype = resolution.archetype,
            confidence = resolution.confidence,
            roleTitle = request.roleTitle.trim(),
            roundType = roundType.dbValue,
            language = request.language,
            consentAudio = request.consentAudio,
            consentVideo = request.consentVideo,
            durationMinutes = request.durationMinutes,
        )
    }

    /**
     * Everything that needs the model, done with no transaction open, then the opening
     * turn written in one short one.
     */
    private fun composeAndOpen(
        userId: UUID,
        sessionId: UUID,
        request: StartSessionRequest,
        roundType: RoundType,
        resolution: ArchetypeResolution,
    ): SessionView {
        val background = resumeService.backgroundFor(userId)
        val brief =
            briefFor(
                company = request.companyName.trim(),
                resolution = resolution,
                role = request.roleTitle.trim(),
                roundType = roundType,
                language = request.language,
                background = background,
            )
        // A DSA or design round is conducted around material — a problem, or a case — and
        // its opening is templated from that rather than asked of the model separately.
        // One call, not two, on the path the candidate is already waiting on. When the bank
        // holds this company's questions for the round, the material *is* one of them. When
        // it holds none, a problem or case from the pool is used as it stands — no call at all.
        val workspaceRound = roundType in RoundWorkspaceComposer.ROUND_TYPES
        val bankRound = if (workspaceRound) bankRounds.forRound(request.companyName.trim(), roundType) else null
        val seed = bankRound?.let { bankRounds.next(userId, sessionId, it) }
        val fromPool =
            if (workspaceRound && bankRound == null) {
                poolRounds
                    .forRound(
                        request.companyName.trim(),
                        resolution.archetype,
                        roundType,
                        request.roleTitle,
                        background?.tenure?.totalExperienceMonths,
                    )?.let { poolRounds.next(userId, sessionId, it) }
                    ?.let { roundWorkspaceComposer.fromPool(it, roundType, request.durationMinutes) }
            } else {
                null
            }
        val workspace =
            fromPool ?: AiSpendContext.of(userId, sessionId) {
                roundWorkspaceComposer.compose(brief, roundType, request.durationMinutes, seed)
            }
        val plan = InterviewPlan.opening(request.durationMinutes, hasWarmup = workspace == null)

        val opening =
            workspace?.let {
                AskedQuestion(
                    text = it.openingQuestion,
                    questionBasis = it.basis,
                    questionProbes = it.probes,
                    questionAskedBecause = it.askedBecause,
                )
            } ?: try {
                AiSpendContext
                    .of(userId, sessionId) {
                        interviewAi.composeOpeningQuestion(brief, plan.toContext())
                    }.value
            } catch (e: AiUnavailableException) {
                repository.markSessionStatus(sessionId, userId, "failed")
                log.warn("Opening question failed for session {}", sessionId, e)
                throw ApiException.upstreamUnavailable(
                    "The interviewer could not be reached just now. Nothing was charged — please try again.",
                )
            }

        inTransaction {
            workspace?.let { repository.setWorkspace(sessionId, userId, it.json) }
            repository.insertTurn(
                sessionId = sessionId,
                userId = userId,
                turnIndex = 0,
                questionText = opening.text,
                phase = plan.phase,
                // Pending means "a voice is coming". Nothing is coming when the room
                // speaks for itself, and saying otherwise leaves it polling for ever.
                speechStatus = if (request.speaksLocally) SpeechStatus.UNAVAILABLE else SpeechStatus.PENDING,
                provenanceJson =
                    provenanceJson(
                        company = request.companyName.trim(),
                        basis = opening.questionBasis,
                        probes = opening.questionProbes,
                        askedBecause = opening.questionAskedBecause,
                        bankQuestion = workspace?.bankQuestion,
                        poolQuestion = workspace?.poolQuestion,
                    ),
                bankQuestionId = workspace?.bankQuestion?.id,
                poolQuestionId = workspace?.poolQuestion?.question?.id,
            )
            // Registered inside the transaction so it runs once the turn has committed —
            // the background renderer writes to the row this has just inserted.
            if (!request.speaksLocally) {
                questionSpeech.render(SpeechRequest(userId, sessionId, 0, opening.text, request.language))
            }
        }

        return view(userId, sessionId)
    }

    /**
     * Runs [block] in its own short transaction.
     *
     * Programmatic rather than `@Transactional`, because the whole point is to open and
     * close transactions *inside* one method — around the database writes and not around
     * the model call between them — and a self-invoked annotated method would not go
     * through the proxy at all.
     */
    private fun <T> inTransaction(block: () -> T): T = transactions.execute { block() }

    @Transactional
    fun submitAnswer(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
        audio: AnswerAudio,
        video: ByteArray?,
        videoContentType: String?,
        /** The browser will read the next question out itself. See [StartSessionRequest]. */
        speaksLocally: Boolean = false,
        /**
         * The candidate pressed Submit mid-answer: assess this answer as the last one and
         * end the round, rather than asking another question they have chosen not to take.
         */
        endRound: Boolean = false,
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

        // Keeping the recording is worth doing but not worth ending the round for: the
        // candidate has already spoken, the transcript is what the report is built from,
        // and losing the interview over a storage blip would be the worse failure.
        //
        // It also has no bearing on what gets asked next, so it uploads alongside the
        // assessment rather than ahead of it: the candidate waits for the longer of the
        // two rather than for their sum.
        val storedMedia =
            CompletableFuture.supplyAsync(
                {
                    StoredMedia(
                        audioPath = storeOrWarn(userId, sessionId, "turn-$turnIndex-answer", audio.bytes, audio.contentType),
                        videoPath =
                            video?.let {
                                storeOrWarn(userId, sessionId, "turn-$turnIndex-video", it, videoContentType ?: "video/webm")
                            },
                    )
                },
                backgroundExecutor,
            )

        // The plan for what happens next, decided here rather than by the model: this
        // answer is in the bag, so the count it is planned against includes it.
        val plan =
            InterviewPlan.forTurn(
                turnIndex = turnIndex + 1,
                answeredTurns = repository.countAnsweredTurns(sessionId, userId) + 1,
                startedAt = session.startedAt,
                durationMinutes = session.durationMinutes,
                now = Instant.now(),
                hasWarmup = session.workspace == null,
            )

        val roundType = RoundType.fromDbValue(session.roundType)
        val resolution =
            ArchetypeResolution(Archetype.fromDbValue(session.archetype), confidenceOf(session.archetypeConfidence))
        // The question planned for the next turn, if the round has one to offer. Never in the
        // warm-up or once the round is closing, and never in a workspace round, whose material
        // already is the question. The first question of the round proper must be it.
        val askNow = plan.briefTheCandidate
        val background = resumeService.backgroundFor(userId)
        val planned =
            if (session.workspace == null && !plan.mustConclude && (plan.phase == TurnPhase.MAIN || askNow)) {
                plannedQuestion(userId, session, roundType, resolution.archetype, background?.tenure?.totalExperienceMonths)
            } else {
                null
            }
        val brief =
            briefFor(
                company = session.companyName,
                resolution = resolution,
                role = session.roleTitle,
                roundType = roundType,
                language = session.language,
                background = background,
                planned = planned?.let { PlannedQuestion(it.text, session.companyName, askNow, reported = it is PlannedFrom.Bank) },
            )
        val priorTurns =
            repository
                .listTranscript(sessionId, userId)
                .filter { it.turnIndex < turnIndex && it.answerTranscript != null }
                .map { it.toTranscript() }

        val assessment =
            try {
                AiSpendContext.of(userId, sessionId) {
                    interviewAi.assessAnswer(
                        brief = brief,
                        round = plan.toContext(),
                        priorTurns = priorTurns,
                        currentQuestion = turn.questionText,
                        answer = audio,
                        // Stored either way, and analysed only if the round is configured to.
                        // A minute of camera is several times the size of the whole prompt and
                        // roughly doubles the wait the candidate sits through, for one sentence
                        // about body language that is not in the report yet. See
                        // [RoundMediaProperties].
                        video = roundMedia.videoForRound(video, videoContentType),
                    )
                }
            } catch (e: AiUnavailableException) {
                repository.markSessionStatus(sessionId, userId, "failed")
                log.warn("Answer assessment failed for session {} turn {}", sessionId, turnIndex, e)
                throw ApiException.upstreamUnavailable(
                    "We could not process that answer. The interview has been stopped rather than scored unfairly.",
                )
            }

        val nextAction = normaliseAction(assessment.value.suggestedNextAction)
        val intervention = Intervention.parse(assessment.value.intervention)
        // The upload has almost always finished under the assessment by now. Joining it
        // cannot fail the turn: storeOrWarn has already turned its own errors into nulls.
        val media = storedMedia.join()
        repository.recordAnswer(
            sessionId = sessionId,
            userId = userId,
            turnIndex = turnIndex,
            transcript = assessment.value.transcript,
            audioPath = media.audioPath,
            videoPath = media.videoPath,
            assessmentJson = objectMapper.writeValueAsString(assessment.value),
            nextAction = nextAction,
            intervention = intervention.wireValue,
            // Only keep a note when help was actually given, so the report cannot
            // report assistance that did not happen.
            interventionNote = assessment.value.interventionNote?.takeIf { intervention.isAssisted },
            deliveryNote = assessment.value.deliveryObservation?.takeIf { it.isNotBlank() },
        )

        val answered = repository.countAnsweredTurns(sessionId, userId)
        // The clock ends the round. `mustConclude` also covers the turn ceiling, which is
        // there so a runaway session cannot run up an unbounded model bill.
        val shouldConclude = endRound || plan.mustConclude || nextAction == "conclude"
        if (shouldConclude) {
            repository.markSessionStatus(sessionId, userId, "completed")
            return SubmitAnswerResponse(
                sessionComplete = true,
                turnsCompleted = answered,
                nextTurn = null,
                // The clock wins over the button. When time runs out the room submits the
                // answer in progress itself, and it arrives here looking exactly like a
                // candidate pressing Submit — thanking them for a decision they did not make
                // would be the machine not noticing what happened.
                closingRemark =
                    ClosingRemark.forRound(ranOutOfTime = plan.outOfTime, endedByCandidate = endRound && !plan.outOfTime),
            )
        }

        // Trimmed here rather than trusted to the prompt: three rounds of telling the
        // model not to open with "That's a great overview" did not stop it.
        val modelText =
            assessment.value.nextQuestionText
                ?.let { QuestionText.withoutPreamble(it) }
                ?.takeIf { it.isNotBlank() }
        if (modelText == null) {
            // The model had nothing left to ask. That is a conclusion too, and it gets the
            // same goodbye — the candidate cannot tell this apart from a planned ending,
            // and should not have to.
            repository.markSessionStatus(sessionId, userId, "completed")
            return SubmitAnswerResponse(
                sessionComplete = true,
                turnsCompleted = answered,
                nextTurn = null,
                closingRemark = ClosingRemark.forRound(ranOutOfTime = false),
            )
        }

        // Whether this turn asks the planned question is the engine's call, checked against
        // its stored wording; a drifted question is replaced after its lead-in.
        val asked = PlannedQuestionCheck.resolveText(planned?.text, askNow, assessment.value.askedPlannedQuestion, modelText)
        val askedFrom = planned?.takeIf { asked.askedPlanned }
        val nextText = asked.text
        val nextIndex = turnIndex + 1
        repository.insertTurn(
            sessionId = sessionId,
            userId = userId,
            turnIndex = nextIndex,
            questionText = nextText,
            phase = plan.phase,
            // Pending means "a voice is coming". Nothing is coming when the room
            // speaks for itself, and saying otherwise leaves it polling for ever.
            speechStatus = if (speaksLocally) SpeechStatus.UNAVAILABLE else SpeechStatus.PENDING,
            provenanceJson =
                provenanceJson(
                    company = session.companyName,
                    basis = assessment.value.questionBasis,
                    probes = assessment.value.questionProbes.takeIf { asked.faithful },
                    askedBecause = assessment.value.questionAskedBecause.takeIf { asked.faithful },
                    bankQuestion = (askedFrom as? PlannedFrom.Bank)?.question,
                    poolQuestion = askedFrom as? PlannedFrom.Pool,
                ),
            bankQuestionId = (askedFrom as? PlannedFrom.Bank)?.question?.id,
            poolQuestionId = (askedFrom as? PlannedFrom.Pool)?.question?.id,
        )
        // Nothing to synthesise when the room is going to say it: that call is the single
        // most expensive thing in a turn and it would be thrown away.
        if (!speaksLocally) {
            questionSpeech.render(SpeechRequest(userId, sessionId, nextIndex, nextText, session.language))
        }

        // The question goes back in writing straight away and its voice follows, which
        // the room asks for separately. A candidate ready to start talking should not be
        // held behind audio they may well talk over.
        return SubmitAnswerResponse(
            sessionComplete = false,
            turnsCompleted = answered,
            nextTurn =
                TurnView(
                    turnIndex = nextIndex,
                    questionText = nextText,
                    questionAudioUrl = null,
                    questionAudioStatus = SpeechStatus.PENDING.dbValue,
                    phase = plan.phase.dbValue,
                    answered = false,
                ),
        )
    }

    /**
     * A nudge on the question the candidate is currently stuck on.
     *
     * One per question, and recorded against them. A candidate frozen on a question had
     * no move but silence before this, which is neither realistic — a real interviewer
     * nudges — nor useful, because a round that stalls produces nothing to score. Making
     * help askable is only fair to everyone else if asking is also counted, so the level
     * the model judges it at is stored and weighed in the report.
     *
     * A hint that cannot be produced does not fail the session. Unlike an assessment,
     * nothing is being scored here, so the round carries on without one.
     */
    @Transactional
    fun requestHint(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
    ): HintView {
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

        // Asking twice returns the same hint rather than buying a second one. Idempotent
        // because a dropped response or a double click should not cost the candidate
        // more credit than they asked to spend.
        turn.hintText?.let { existing ->
            val level = Intervention.parse(turn.hintLevel)
            return HintView(turnIndex, existing, level.wireValue, level.label)
        }

        val roundType = RoundType.fromDbValue(session.roundType)
        val resolution =
            ArchetypeResolution(Archetype.fromDbValue(session.archetype), confidenceOf(session.archetypeConfidence))
        val brief = briefFor(session.companyName, resolution, session.roleTitle, roundType, session.language)
        val plan =
            InterviewPlan.forTurn(
                turnIndex = turnIndex,
                answeredTurns = repository.countAnsweredTurns(sessionId, userId),
                startedAt = session.startedAt,
                durationMinutes = session.durationMinutes,
                now = Instant.now(),
                hasWarmup = session.workspace == null,
            )
        val priorTurns =
            repository
                .listTranscript(sessionId, userId)
                .filter { it.turnIndex < turnIndex && it.answerTranscript != null }
                .map { it.toTranscript() }

        val offered =
            try {
                AiSpendContext.of(userId, sessionId) {
                    interviewAi.offerHint(brief, plan.toContext(), priorTurns, turn.questionText)
                }
            } catch (e: AiUnavailableException) {
                log.warn("Hint unavailable for session {} turn {}", sessionId, turnIndex, e)
                throw ApiException.upstreamUnavailable(
                    "The interviewer could not be reached for that. Your round is unaffected - answer as best you can.",
                )
            }

        // A level the model did not supply must not read as free help, so anything
        // unrecognised falls to `hinted` rather than to `none`.
        val level = Intervention.parse(offered.value.assistanceLevel).takeIf { it.isAssisted } ?: Intervention.HINTED
        repository.recordHint(sessionId, userId, turnIndex, offered.value.text, level.wireValue)

        return HintView(turnIndex, offered.value.text, level.wireValue, level.label)
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

    /**
     * Runs the candidate's code for a session they own.
     *
     * Ownership is the whole authorisation story: without the session check this is an
     * open code-execution endpoint. The round's state is deliberately not consulted
     * beyond that — someone re-running their solution after the clock stopped, while they
     * wait for the report, is doing something reasonable.
     */
    fun runCode(
        userId: UUID,
        sessionId: UUID,
        request: RunCodeRequest,
    ): CodeRunResult {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val language =
            CodeLanguage.parse(request.language)
                ?: throw ApiException.badRequest("This round takes Python or Java.")
        return codeRunner.run(language, request.source, request.stdin)
    }

    /** Stores the board, so a reload does not lose twenty minutes of drawing. */
    fun saveBoard(
        userId: UUID,
        sessionId: UUID,
        board: JsonNode,
    ) {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        repository.setBoard(sessionId, userId, objectMapper.writeValueAsString(board))
    }

    /**
     * The candidate has said all they want to say: end the round now and let the report
     * be written from what they have answered.
     *
     * This is the opposite of [abandon]. Leaving forfeits the round — no report, and it is
     * not counted as practice. Submitting completes it: the answers given so far are
     * assessed exactly as they would be had the clock run out.
     *
     * A round with nothing answered has nothing to assess, so it cannot be submitted; the
     * room only offers the button once there is an answer on the record.
     */
    @Transactional
    fun finish(
        userId: UUID,
        sessionId: UUID,
    ): SubmitAnswerResponse {
        val session = repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (session.status != "in_progress") {
            throw ApiException.conflict("This interview is no longer running.", code = "session_not_running")
        }
        val answered = repository.countAnsweredTurns(sessionId, userId)
        if (answered == 0) {
            throw ApiException.conflict(
                "Answer at least one question before submitting — there is nothing to assess yet.",
                code = "nothing_to_assess",
            )
        }
        // Also how the room ends a round whose clock has run out between answers, so the
        // goodbye says which of the two it was.
        val outOfTime =
            InterviewPlan
                .forTurn(
                    turnIndex = answered,
                    answeredTurns = answered,
                    startedAt = session.startedAt,
                    durationMinutes = session.durationMinutes,
                    now = Instant.now(),
                ).outOfTime
        repository.markSessionStatus(sessionId, userId, "completed")
        return SubmitAnswerResponse(
            sessionComplete = true,
            turnsCompleted = answered,
            nextTurn = null,
            closingRemark = ClosingRemark.forRound(ranOutOfTime = outOfTime, endedByCandidate = !outOfTime),
        )
    }

    /**
     * The candidate has entered the room, so the round's clock starts now — not when the
     * session row was written, which was before the problem existed and before the device
     * check. Idempotent: see [SessionRepository.startClock]. Returns the session with the
     * deadline the room should count down to.
     */
    fun begin(
        userId: UUID,
        sessionId: UUID,
    ): SessionView {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        repository.startClock(sessionId, userId)
        return view(userId, sessionId)
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
        val workspace = session.workspace?.let(objectMapper::readTree)
        // A workspace round is either set on a bank question or it is not, and the workspace
        // says which; a spoken round is described by what the bank holds for it.
        val sourcedQuestions =
            if (workspace != null) {
                if (workspace.path("bankQuestionId").isString) 1 else 0
            } else {
                bankRounds.questionCount(session.companyName, roundType)
            }

        return SessionView(
            id = session.id,
            companyName = session.companyName,
            archetype = archetype.dbValue,
            archetypeLabel = archetype.label,
            archetypeConfidence = confidence.dbValue,
            groundingNote = candidateFacingNote(session.companyName, archetype, confidence, roundType, sourcedQuestions),
            roleTitle = session.roleTitle,
            roundType = roundType.dbValue,
            roundLabel = roundType.label,
            language = session.language,
            status = session.status,
            consentVideo = session.consentVideo,
            startedAt = session.startedAt,
            endedAt = session.endedAt,
            durationMinutes = session.durationMinutes,
            // The deadline is the server's, so a client clock that drifts or a tab that
            // sleeps cannot buy the candidate extra time.
            scheduledEndAt = session.startedAt?.plus(Duration.ofMinutes(session.durationMinutes.toLong())),
            turnsCompleted = repository.countAnsweredTurns(sessionId, userId),
            maxTurns = InterviewPlan.MAX_TURNS,
            workspace = workspace,
            board = session.board?.let(objectMapper::readTree),
            currentTurn =
                latest
                    ?.takeIf { it.answeredAt == null }
                    ?.let { turnViewOf(it) },
        )
    }

    /**
     * One turn, so the room can pick up the interviewer's voice once it has rendered.
     *
     * This is a poll rather than a push because the thing being waited on is small, the
     * wait is a few seconds, and a candidate who starts answering before the voice lands
     * has lost nothing — the question was already in front of them in writing.
     */
    fun turn(
        userId: UUID,
        sessionId: UUID,
        turnIndex: Int,
    ): TurnView {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val turn =
            repository.findTurn(sessionId, userId, turnIndex)
                ?: throw ApiException.notFound("That question is not part of this interview.")
        return turnViewOf(turn)
    }

    /**
     * The question a spoken round plans next, in the task-042 order: the sourced bank when
     * it holds anything for this company and round type — it keeps first claim, exactly as
     * before — and the AI pool only when it holds nothing. Null means live questions.
     */
    private fun plannedQuestion(
        userId: UUID,
        session: SessionRow,
        roundType: RoundType,
        archetype: Archetype,
        experienceMonths: Int?,
    ): PlannedFrom? {
        bankRounds.forRound(session.companyName, roundType)?.let { round ->
            return bankRounds.next(userId, session.id, round)?.let { PlannedFrom.Bank(it) }
        }
        return poolRounds
            .forRound(session.companyName, archetype, roundType, session.roleTitle, experienceMonths)
            ?.let { poolRounds.next(userId, session.id, it) }
    }

    /**
     * Why a question was asked, ready to store.
     *
     * Decided per turn: [bankQuestion] is the bank question this turn asked, or null. A
     * turn that asked one is `published_source`, citing that question's sources and no
     * others; a turn that asked [poolQuestion] is `model_knowledge` with that question's
     * label; every other turn — follow-ups included, in a round full of bank questions —
     * is `model_knowledge`. The model never gets a vote either way.
     */
    private fun provenanceJson(
        company: String,
        basis: String?,
        probes: String?,
        askedBecause: String?,
        bankQuestion: BankQuestion?,
        poolQuestion: PlannedFrom.Pool? = null,
    ): String? {
        val provenance =
            when {
                bankQuestion != null -> QuestionProvenance.fromBank(bankQuestion, company, probes, askedBecause)
                poolQuestion != null -> QuestionProvenance.fromPool(poolQuestion.label, probes, askedBecause)
                else -> QuestionProvenance.fromModel(basis, probes, askedBecause)
            }
        return provenance?.let { objectMapper.writeValueAsString(it) }
    }

    /**
     * A candidate's past rounds, with the retention rule already applied to each.
     *
     * The expiry date is computed here rather than in the browser, and the window itself
     * is sent along on every row, because how long a report is kept is server policy — one
     * property in `application.yml`. A client that hardcoded "28 days" into a sentence
     * would keep saying it on the day somebody changed the property, and the client that
     * matters most is the mobile app that does not exist yet and cannot be edited in the
     * same release.
     */
    fun list(userId: UUID): List<SessionSummary> =
        repository.listSessions(userId).map { row ->
            SessionSummary(
                id = row.id,
                companyName = row.companyName,
                roleTitle = row.roleTitle,
                roundType = row.roundType,
                status = row.status,
                startedAt = row.startedAt,
                endedAt = row.endedAt,
                hasReport = row.hasReport,
                reportExpired = row.reportExpiredAt != null,
                // Null once it has expired: there is no future date to show for a report
                // that has already gone, and a client rendering one would be promising
                // something that is not there.
                reportExpiresAt =
                    row.retentionFrom
                        ?.takeIf { row.reportExpiredAt == null }
                        ?.let { retentionProperties.expiresAt(it) },
                reportRetentionDays = retentionProperties.days,
            )
        }

    /**
     * A turn as the room sees it.
     *
     * The URL is signed only once the speech is actually `ready`. A `pending` turn that
     * happened to carry a stale path would otherwise hand the room a URL to nothing.
     */
    private fun turnViewOf(turn: TurnRow): TurnView {
        val status = SpeechStatus.fromDbValue(turn.questionAudioStatus)
        return TurnView(
            turnIndex = turn.turnIndex,
            questionText = turn.questionText,
            questionAudioUrl = if (status == SpeechStatus.READY) signedUrl(turn.questionAudioPath) else null,
            questionAudioStatus = status.dbValue,
            phase = turn.phase,
            answered = turn.answeredAt != null,
        )
    }

    /**
     * What the candidate is told about grounding. Deliberately plain: an inferred
     * archetype is described as a general pattern, never as knowledge of that employer.
     */
    private fun candidateFacingNote(
        company: String,
        archetype: Archetype,
        confidence: Confidence,
        roundType: RoundType,
        sourcedQuestions: Int,
    ): String =
        GroundingNote.forRound(
            company = company,
            archetype = archetype,
            confidence = confidence,
            roundType = roundType,
            sourcedQuestions = sourcedQuestions,
            workspaceRound = roundType in RoundWorkspaceComposer.ROUND_TYPES,
        )

    /**
     * Archetype patterns, then the candidate's own background.
     *
     * There is no list of the employer's reported questions here any more, on purpose. A
     * model handed twelve of them asked whichever it liked, and the engine could not tell
     * which turn was which — so every turn was stamped as sourced. The bank reaches the
     * model only as the one planned question, whose asking the engine checks.
     */
    private fun groundingText(
        resolution: ArchetypeResolution,
        background: CandidateBackground?,
        resumeUse: ResumeUse,
    ): String =
        listOfNotNull(
            resolution.grounding,
            background?.asPrompt(resumeUse),
        ).joinToString(separator = "\n\n")

    private fun briefFor(
        company: String,
        resolution: ArchetypeResolution,
        role: String,
        roundType: RoundType,
        language: String,
        background: CandidateBackground? = null,
        planned: PlannedQuestion? = null,
    ) = InterviewBrief(
        company = company,
        archetype = resolution.archetype.label,
        role = role,
        roundType = "${roundType.label}. ${roundType.brief}",
        roundCovers = roundType.covers.joinToString("\n") { "- $it" },
        language = language,
        // Null on every round until the resume existed, which is precisely why the
        // project deep-dive had nothing of the candidate's own to dig into.
        candidateFunction = background?.resume?.headline,
        candidateLevel = background?.let { "${it.tenure.totalExperienceMonths / 12} years of experience" },
        targetLevel = null,
        grounding = groundingText(resolution, background, roundType.resumeUse),
        plannedQuestion = planned,
    )

    private fun TurnPlan.toContext() =
        RoundContext(
            phase =
                when (phase) {
                    TurnPhase.WARMUP -> "warm-up"
                    TurnPhase.MAIN -> "main round"
                    TurnPhase.CLOSING -> "closing"
                },
            minutesElapsed = minutesElapsed,
            minutesRemaining = minutesRemaining,
            durationMinutes = durationMinutes,
            warmupInstruction = warmupFocus?.instruction,
            briefTheCandidate = briefTheCandidate,
            mustConclude = mustConclude,
        )

    private fun TurnRow.toTranscript() =
        TurnTranscript(
            questionText = questionText,
            answerTranscript = answerTranscript,
            intervention = Intervention.parse(intervention),
            interventionNote = interventionNote,
            warmUp = TurnPhase.fromDbValue(phase) == TurnPhase.WARMUP,
            deliveryNote = deliveryNote,
        )

    /** Media is evidence, not a precondition. A failure is logged and the round goes on. */
    private fun storeOrWarn(
        userId: UUID,
        sessionId: UUID,
        name: String,
        bytes: ByteArray,
        contentType: String,
    ): String? =
        try {
            store(userId, sessionId, name, bytes, contentType)
        } catch (e: ObjectStorageException) {
            log.warn("Could not store {} for session {}", name, sessionId, e)
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
        const val SIGNED_URL_SECONDS = 3600
        const val DEFAULT_ROUND_MINUTES = 40
        const val MIN_ROUND_MINUTES = 10
        const val MAX_ROUND_MINUTES = 120
        val DRAFT_CONFIDENCES = setOf("high", "medium", "low")
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

/** Where an answer's recordings ended up. Either may be null: storage is not a gate. */
private data class StoredMedia(
    val audioPath: String?,
    val videoPath: String?,
)
