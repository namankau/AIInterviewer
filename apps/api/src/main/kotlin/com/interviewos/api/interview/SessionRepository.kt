package com.interviewos.api.interview

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/**
 * Persistence for the interview loop.
 *
 * Every query is scoped by `user_id` taken from the verified token. The API connects as
 * the database owner and is therefore not constrained by RLS — the policies protect the
 * direct-from-browser path, and these predicates protect this one. A query here that
 * forgets its `user_id` clause is a cross-tenant data leak, so there are no unscoped
 * reads of user data in this class.
 */
@Repository
class SessionRepository(
    private val jdbcClient: JdbcClient,
) {
    // -- entitlement inputs ---------------------------------------------------

    fun countCompletedSessions(userId: UUID): Int =
        jdbcClient
            .sql("select count(*) from public.sessions where user_id = :u and status = 'completed'")
            .param("u", userId)
            .query(Int::class.java)
            .single()

    /**
     * How much interviewing this product has actually done, across everyone.
     *
     * Counted from the rows rather than kept as a running total, for the same reason
     * progress is derived rather than declared (CLAUDE.md): a counter that is incremented
     * somewhere drifts from the thing it counts, and this one is shown to the public.
     *
     * Cheap enough to run per request at this size; if it stops being, it becomes a
     * materialised view rather than a number someone remembers to bump.
     */
    fun usageCounts(): UsageCounts =
        jdbcClient
            .sql(
                """
                select
                  (select count(*) from public.sessions where status = 'completed') as interviews,
                  (select count(*) from public.session_reports)                     as reports
                """.trimIndent(),
            ).query { rs, _ ->
                UsageCounts(
                    interviewsCompleted = rs.getLong("interviews"),
                    reportsGenerated = rs.getLong("reports"),
                )
            }.single()

    fun countPaidSessionCredits(userId: UUID): Int =
        jdbcClient
            .sql("select count(*) from public.payments where user_id = :u and status = 'paid'")
            .param("u", userId)
            .query(Int::class.java)
            .single()

    fun findOpenSessionId(userId: UUID): UUID? =
        jdbcClient
            .sql(
                """
                select id from public.sessions
                 where user_id = :u and status in ('created', 'in_progress')
                 order by created_at desc limit 1
                """.trimIndent(),
            ).param("u", userId)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    // -- sessions -------------------------------------------------------------

    fun insertSession(
        userId: UUID,
        companyName: String,
        archetype: Archetype,
        confidence: Confidence,
        roleTitle: String,
        roundType: String,
        language: String,
        consentAudio: Boolean,
        consentVideo: Boolean,
        durationMinutes: Int,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.sessions (
                    user_id, company_name, company_archetype, role_title, round_type, language,
                    status, started_at, consent_audio_at, consent_video_at, archetype_confidence,
                    duration_minutes
                ) values (
                    :u, :company, cast(:archetype as public.employer_archetype), :role,
                    cast(:round as public.round_type), cast(:language as public.interview_language),
                    'in_progress', now(),
                    case when :consentAudio then now() end,
                    case when :consentVideo then now() end,
                    :confidence, :durationMinutes
                )
                returning id
                """.trimIndent(),
            ).param("u", userId)
            .param("company", companyName)
            .param("archetype", archetype.dbValue)
            .param("role", roleTitle)
            .param("round", roundType)
            .param("language", language)
            .param("consentAudio", consentAudio)
            .param("consentVideo", consentVideo)
            .param("durationMinutes", durationMinutes)
            .param("confidence", confidence.dbValue)
            .query(UUID::class.java)
            .single()

    fun findSession(
        sessionId: UUID,
        userId: UUID,
    ): SessionRow? =
        jdbcClient
            .sql(
                """
                select id, company_name, company_archetype::text as archetype, role_title,
                       round_type::text as round_type, language::text as language,
                       status::text as status, started_at, ended_at, report_expired_at,
                       (consent_video_at is not null) as consent_video, duration_minutes,
                       coalesce(archetype_confidence, 'inferred') as archetype_confidence,
                       workspace::text as workspace, board::text as board
                  from public.sessions
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapSession(rs) }
            .optional()
            .orElse(null)

    /**
     * A candidate's rounds, newest first.
     *
     * Returns rows rather than the API shape because when a round's report expires is
     * policy, not data — it is [RetentionProperties] applied to `retention_from`, and the
     * service does that arithmetic. The database's job here is to say when the round
     * happened and whether it has already been cleared.
     */
    fun listSessions(userId: UUID): List<SessionListRow> =
        jdbcClient
            .sql(
                """
                select s.id, s.company_name, s.role_title, s.round_type::text as round_type,
                       s.status::text as status, s.started_at, s.ended_at, s.report_expired_at,
                       coalesce(s.ended_at, s.created_at) as retention_from,
                       (r.id is not null) as has_report
                  from public.sessions s
                  left join public.session_reports r on r.session_id = s.id
                 where s.user_id = :u
                 order by s.created_at desc
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                SessionListRow(
                    id = rs.getObject("id", UUID::class.java),
                    companyName = rs.getString("company_name"),
                    roleTitle = rs.getString("role_title"),
                    roundType = rs.getString("round_type"),
                    status = rs.getString("status"),
                    startedAt = rs.getTimestamp("started_at")?.toInstant(),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
                    retentionFrom = rs.getTimestamp("retention_from")?.toInstant(),
                    reportExpiredAt = rs.getTimestamp("report_expired_at")?.toInstant(),
                    hasReport = rs.getBoolean("has_report"),
                )
            }.list()

    fun markSessionStatus(
        sessionId: UUID,
        userId: UUID,
        status: String,
    ) {
        jdbcClient
            .sql(
                """
                update public.sessions
                   set status = cast(:status as public.session_status),
                       ended_at = case when :status in ('completed', 'abandoned', 'failed') then now() else ended_at end
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("status", status)
            .param("id", sessionId)
            .param("u", userId)
            .update()
    }

    /**
     * Starts the round's clock, once: the moment the candidate enters the room.
     *
     * `started_at` is written at insert, and until now that was when the clock started —
     * before the problem had been composed, before the device check, before the candidate
     * had seen a single word. A five-minute round opened on 3:50.
     *
     * The insert still writes it, because the constraints need a start before any end and
     * a round abandoned during setup still ends. What marks the clock as not yet started
     * is `started_at = created_at`: both are `now()` in the insert's own transaction, so
     * they are equal to the microsecond until this moves one of them. That makes the
     * update idempotent — reloading the room mid-round finds them unequal and changes
     * nothing, so a refresh never buys anybody more time.
     */
    fun startClock(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.sessions
                   set started_at = now()
                 where id = :id and user_id = :u
                   and status = 'in_progress'
                   and started_at = created_at
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .update() == 1

    /**
     * Stores the material this round is conducted around, composed once at the start.
     *
     * Separate from `insertSession` because composing it needs the session to exist: the
     * model call is attributed to the session in the spend ledger, and a call made before
     * the row existed would be a call nobody can account for.
     */
    fun setWorkspace(
        sessionId: UUID,
        userId: UUID,
        workspaceJson: String,
    ) {
        jdbcClient
            .sql("update public.sessions set workspace = cast(:w as jsonb) where id = :id and user_id = :u")
            .param("w", workspaceJson)
            .param("id", sessionId)
            .param("u", userId)
            .update()
    }

    /**
     * Stores what the candidate produced on the board — the design they drew, or the code
     * they wrote.
     *
     * Written repeatedly as they work, so it survives a reload. PRD 06 is explicit that
     * nothing about a session may be lost to a refresh, and a design somebody spent
     * twenty minutes drawing is the most expensive thing in the room to lose.
     */
    fun setBoard(
        sessionId: UUID,
        userId: UUID,
        boardJson: String,
    ) {
        jdbcClient
            .sql("update public.sessions set board = cast(:b as jsonb) where id = :id and user_id = :u")
            .param("b", boardJson)
            .param("id", sessionId)
            .param("u", userId)
            .update()
    }

    // -- deletion and retention -----------------------------------------------

    /**
     * Removes one round entirely, and says whether there was one to remove.
     *
     * One statement, because `session_turns` and `session_reports` both cascade from
     * `public.sessions` — the transcript and the report go with the row, enforced by the
     * database rather than by three deletes here remembering to stay in step. That is the
     * point: a fourth child table added later inherits this deletion for free if it
     * declares its foreign key the way the other two do, and fails loudly if it does not.
     *
     * The `user_id` predicate is the entire authorisation check. A caller asking for
     * somebody else's session gets `false` and, above this, a 404 — which is the same
     * answer they get for a session that never existed, and deliberately so.
     *
     * Returns false rather than throwing so the caller can decide; it also makes a second
     * delete of the same round idempotent rather than a 500.
     */
    fun deleteSession(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbcClient
            .sql("delete from public.sessions where id = :id and user_id = :u")
            .param("id", sessionId)
            .param("u", userId)
            .update() > 0

    /**
     * Rounds old enough to be cleared, oldest first.
     *
     * Deliberately not scoped by user — this is the only query in this class that is not,
     * and it is the retention sweep rather than anything serving a request. It returns
     * the owner alongside the id because every write and every storage key that follows is
     * scoped by both.
     */
    fun listRoundsDueForExpiry(
        endedBefore: Instant,
        limit: Int,
    ): List<ExpiringRound> =
        jdbcClient
            .sql(
                """
                select id, user_id
                  from public.sessions
                 where report_expired_at is null
                   and coalesce(ended_at, created_at) < :cutoff
                 order by coalesce(ended_at, created_at)
                 limit :limit
                """.trimIndent(),
            ).param("cutoff", java.sql.Timestamp.from(endedBefore))
            .param("limit", limit)
            .query { rs, _ ->
                ExpiringRound(
                    sessionId = rs.getObject("id", UUID::class.java),
                    userId = rs.getObject("user_id", UUID::class.java),
                )
            }.list()

    /**
     * Clears one round's report and transcript and stamps it as expired, keeping the
     * session row.
     *
     * **One statement, and it has to be.** Half of this — the report deleted, the turns
     * still there — is the state in which [ReportService] would compose a *brand new*
     * report from the surviving transcript the next time the candidate opened it: a model
     * call producing a different report from the one they remember, silently, out of data
     * that was supposed to be gone. Postgres runs data-modifying CTEs exactly once and to
     * completion, in one snapshot, so the three writes here cannot come apart. That is
     * also why this is not three calls behind an `@Transactional` service method — the
     * caller is in the same bean, and a self-invocation never reaches the proxy that would
     * have opened the transaction.
     *
     * The `update` is the primary query rather than a third CTE so its row count is the
     * return value: false means no such round belongs to that user, and the deletes above
     * it matched nothing either, both being scoped the same way.
     */
    fun expireRound(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with cleared_report as (
                    delete from public.session_reports where session_id = :s and user_id = :u
                ), cleared_turns as (
                    delete from public.session_turns where session_id = :s and user_id = :u
                )
                update public.sessions
                   set report_expired_at = now()
                 where id = :s and user_id = :u
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .update() > 0

    // -- turns ----------------------------------------------------------------

    /**
     * Records a question. The turn is written before its audio exists, so the candidate
     * can start reading immediately; [speechStatus] says whether a voice is still coming.
     */
    fun insertTurn(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        questionText: String,
        phase: TurnPhase,
        speechStatus: SpeechStatus,
        provenanceJson: String?,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.session_turns
                       (session_id, user_id, turn_index, question_text, phase, question_audio_status, provenance)
                values (:s, :u, :i, :q, cast(:phase as public.turn_phase), cast(:speech as public.speech_status),
                        cast(:provenance as jsonb))
                on conflict (session_id, turn_index) do nothing
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .param("q", questionText)
            .param("phase", phase.dbValue)
            .param("speech", speechStatus.dbValue)
            .param("provenance", provenanceJson)
            .update()
    }

    /**
     * Attaches the spoken question once it has rendered, or marks it as never coming.
     *
     * Written from a background thread after the answering transaction has committed, so
     * it deliberately does not touch anything else on the row.
     */
    fun setQuestionSpeech(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        audioPath: String?,
        status: SpeechStatus,
    ) {
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set question_audio_path = :audio,
                       question_audio_status = cast(:status as public.speech_status)
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("audio", audioPath)
            .param("status", status.dbValue)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update()
    }

    fun findTurn(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
    ): TurnRow? =
        jdbcClient
            .sql(
                """
                select turn_index, question_text, question_audio_path,
                       question_audio_status::text as question_audio_status,
                       answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note,
                       phase::text as phase, delivery_note, provenance::text as provenance,
                       hint_requested_at, hint_text, hint_level::text as hint_level
                  from public.session_turns
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .query { rs, _ -> mapTurn(rs) }
            .optional()
            .orElse(null)

    fun findLatestTurn(
        sessionId: UUID,
        userId: UUID,
    ): TurnRow? =
        jdbcClient
            .sql(
                """
                select turn_index, question_text, question_audio_path,
                       question_audio_status::text as question_audio_status,
                       answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note,
                       phase::text as phase, delivery_note, provenance::text as provenance,
                       hint_requested_at, hint_text, hint_level::text as hint_level
                  from public.session_turns
                 where session_id = :s and user_id = :u
                 order by turn_index desc limit 1
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapTurn(rs) }
            .optional()
            .orElse(null)

    /**
     * Records help the candidate asked for, on the turn they asked it on.
     *
     * Deliberately separate from `intervention`, which holds what the interviewer chose
     * to supply in response to the answer. Writing both to one column would let the
     * assessment of an answer overwrite the hint that shaped it.
     */
    fun recordHint(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        hintText: String,
        hintLevel: String,
    ) {
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set hint_requested_at = now(),
                       hint_text = :hint,
                       hint_level = cast(:level as public.intervention_type)
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("hint", hintText)
            .param("level", hintLevel)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update()
    }

    fun recordAnswer(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        transcript: String,
        audioPath: String?,
        videoPath: String?,
        assessmentJson: String,
        nextAction: String,
        intervention: String,
        interventionNote: String?,
        deliveryNote: String?,
    ) {
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set answer_transcript = :t,
                       answer_audio_path = :audio,
                       answer_video_path = :video,
                       answered_at = now(),
                       assessment = cast(:assessment as jsonb),
                       next_action = cast(:action as public.turn_next_action),
                       intervention = cast(:intervention as public.intervention_type),
                       intervention_note = :note,
                       delivery_note = :delivery
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("t", transcript)
            .param("audio", audioPath)
            .param("video", videoPath)
            .param("assessment", assessmentJson)
            .param("action", nextAction)
            .param("intervention", intervention)
            .param("note", interventionNote)
            .param("delivery", deliveryNote)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update()
    }

    fun countAnsweredTurns(
        sessionId: UUID,
        userId: UUID,
    ): Int =
        jdbcClient
            .sql(
                "select count(*) from public.session_turns where session_id = :s and user_id = :u and answered_at is not null",
            ).param("s", sessionId)
            .param("u", userId)
            .query(Int::class.java)
            .single()

    fun listTranscript(
        sessionId: UUID,
        userId: UUID,
    ): List<TurnRow> =
        jdbcClient
            .sql(
                """
                select turn_index, question_text, question_audio_path,
                       question_audio_status::text as question_audio_status,
                       answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note,
                       phase::text as phase, delivery_note, provenance::text as provenance,
                       hint_requested_at, hint_text, hint_level::text as hint_level
                  from public.session_turns
                 where session_id = :s and user_id = :u
                 order by turn_index
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapTurn(rs) }
            .list()

    // -- reports --------------------------------------------------------------

    fun saveReport(
        sessionId: UUID,
        userId: UUID,
        payloadJson: String,
        model: String,
        promptTokens: Int,
        outputTokens: Int,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.session_reports (session_id, user_id, payload, model, prompt_tokens, output_tokens)
                values (:s, :u, cast(:p as jsonb), :m, :pt, :ot)
                on conflict (session_id) do update
                   set payload = excluded.payload,
                       model = excluded.model,
                       prompt_tokens = excluded.prompt_tokens,
                       output_tokens = excluded.output_tokens,
                       generated_at = now()
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("p", payloadJson)
            .param("m", model)
            .param("pt", promptTokens)
            .param("ot", outputTokens)
            .update()
    }

    fun findReportJson(
        sessionId: UUID,
        userId: UUID,
    ): String? =
        jdbcClient
            .sql("select payload::text from public.session_reports where session_id = :s and user_id = :u")
            .param("s", sessionId)
            .param("u", userId)
            .query(String::class.java)
            .optional()
            .orElse(null)

    /** Reports for completed sessions, grouped by (company, role) — the readiness view. */
    fun listReportsForReadiness(userId: UUID): List<ReadinessRow> =
        jdbcClient
            .sql(
                """
                select s.company_name, s.role_title, s.ended_at, r.payload::text as payload
                  from public.sessions s
                  join public.session_reports r on r.session_id = s.id
                 where s.user_id = :u and s.status = 'completed'
                 order by s.company_name, s.role_title, s.ended_at
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                ReadinessRow(
                    companyName = rs.getString("company_name"),
                    roleTitle = rs.getString("role_title"),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
                    payloadJson = rs.getString("payload"),
                )
            }.list()

    private fun mapSession(rs: ResultSet) =
        SessionRow(
            id = rs.getObject("id", UUID::class.java),
            companyName = rs.getString("company_name"),
            archetype = rs.getString("archetype"),
            archetypeConfidence = rs.getString("archetype_confidence"),
            roleTitle = rs.getString("role_title"),
            roundType = rs.getString("round_type"),
            language = rs.getString("language"),
            status = rs.getString("status"),
            startedAt = rs.getTimestamp("started_at")?.toInstant(),
            endedAt = rs.getTimestamp("ended_at")?.toInstant(),
            consentVideo = rs.getBoolean("consent_video"),
            durationMinutes = rs.getInt("duration_minutes"),
            reportExpiredAt = rs.getTimestamp("report_expired_at")?.toInstant(),
            workspace = rs.getString("workspace"),
            board = rs.getString("board"),
        )

    private fun mapTurn(rs: ResultSet) =
        TurnRow(
            turnIndex = rs.getInt("turn_index"),
            questionText = rs.getString("question_text"),
            questionAudioPath = rs.getString("question_audio_path"),
            questionAudioStatus = rs.getString("question_audio_status") ?: SpeechStatus.READY.dbValue,
            answerTranscript = rs.getString("answer_transcript"),
            answeredAt = rs.getTimestamp("answered_at")?.toInstant(),
            intervention = rs.getString("intervention") ?: "none",
            phase = rs.getString("phase"),
            deliveryNote = rs.getString("delivery_note"),
            interventionNote = rs.getString("intervention_note"),
            hintRequestedAt = rs.getTimestamp("hint_requested_at")?.toInstant(),
            hintText = rs.getString("hint_text"),
            hintLevel = rs.getString("hint_level"),
            provenanceJson = rs.getString("provenance"),
        )
}

data class SessionRow(
    val id: UUID,
    val companyName: String,
    val archetype: String,
    val archetypeConfidence: String,
    val roleTitle: String,
    val roundType: String,
    val language: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    /** Whether the candidate agreed to video. The camera must not open without it. */
    val consentVideo: Boolean,
    /** How long this round was scheduled to run. The clock, not a counter, ends it. */
    val durationMinutes: Int,
    /**
     * When retention cleared this round's report, transcript and recordings. Null means
     * nothing has been cleared — which is different from there being no report yet.
     */
    val reportExpiredAt: Instant? = null,
    /** The problem or case this round runs on, as raw JSON. Null for a plain conversation. */
    val workspace: String? = null,
    /** What the candidate drew or wrote, as raw JSON. Null until they touch the board. */
    val board: String? = null,
)

/**
 * One row of a candidate's history, before retention policy has been applied to it.
 *
 * [retentionFrom] is when the round finished, falling back to when it was created for one
 * that never did. [ReportService] and [InterviewService] turn it into an expiry date;
 * nothing in this class knows how long a report is kept.
 */
data class SessionListRow(
    val id: UUID,
    val companyName: String,
    val roleTitle: String,
    val roundType: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val retentionFrom: Instant?,
    val reportExpiredAt: Instant?,
    val hasReport: Boolean,
)

/** A round the retention sweep has found, and the candidate whose data it is. */
data class ExpiringRound(
    val sessionId: UUID,
    val userId: UUID,
)

data class TurnRow(
    val turnIndex: Int,
    val questionText: String,
    val questionAudioPath: String?,
    /** `pending`, `ready` or `unavailable` — whether a voice is still coming for this question. */
    val questionAudioStatus: String = SpeechStatus.READY.dbValue,
    val answerTranscript: String?,
    val answeredAt: Instant?,
    /** What the interviewer had to supply on this turn — see Intervention. */
    val intervention: String = "none",
    val interventionNote: String? = null,
    /** Where this exchange sat in the round: `warmup`, `main` or `closing`. */
    val phase: String = TurnPhase.MAIN.dbValue,
    /** What the interviewer observed about delivery, from the video when there was one. */
    val deliveryNote: String? = null,
    /** Set when the candidate asked for help on this question, rather than being offered it. */
    val hintRequestedAt: Instant? = null,
    val hintText: String? = null,
    /** How much that hint gave away, on the same scale as the interviewer's own help. */
    val hintLevel: String? = null,
    /** Why this question was asked, as raw JSON. Null on turns recorded before provenance existed. */
    val provenanceJson: String? = null,
)

data class ReadinessRow(
    val companyName: String,
    val roleTitle: String,
    val endedAt: Instant?,
    val payloadJson: String,
)
