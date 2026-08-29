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
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.sessions (
                    user_id, company_name, company_archetype, role_title, round_type, language,
                    status, started_at, consent_audio_at, consent_video_at, archetype_confidence
                ) values (
                    :u, :company, cast(:archetype as public.employer_archetype), :role,
                    cast(:round as public.round_type), cast(:language as public.interview_language),
                    'in_progress', now(),
                    case when :consentAudio then now() end,
                    case when :consentVideo then now() end,
                    :confidence
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
                       status::text as status, started_at, ended_at,
                       coalesce(archetype_confidence, 'inferred') as archetype_confidence
                  from public.sessions
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapSession(rs) }
            .optional()
            .orElse(null)

    fun listSessions(userId: UUID): List<SessionSummary> =
        jdbcClient
            .sql(
                """
                select s.id, s.company_name, s.role_title, s.round_type::text as round_type,
                       s.status::text as status, s.started_at, s.ended_at,
                       (r.id is not null) as has_report
                  from public.sessions s
                  left join public.session_reports r on r.session_id = s.id
                 where s.user_id = :u
                 order by s.created_at desc
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                SessionSummary(
                    id = rs.getObject("id", UUID::class.java),
                    companyName = rs.getString("company_name"),
                    roleTitle = rs.getString("role_title"),
                    roundType = rs.getString("round_type"),
                    status = rs.getString("status"),
                    startedAt = rs.getTimestamp("started_at")?.toInstant(),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
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

    // -- turns ----------------------------------------------------------------

    fun insertTurn(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        questionText: String,
        questionAudioPath: String?,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.session_turns (session_id, user_id, turn_index, question_text, question_audio_path)
                values (:s, :u, :i, :q, :audio)
                on conflict (session_id, turn_index) do nothing
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .param("q", questionText)
            .param("audio", questionAudioPath)
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
                select turn_index, question_text, question_audio_path, answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note
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
                select turn_index, question_text, question_audio_path, answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note
                  from public.session_turns
                 where session_id = :s and user_id = :u
                 order by turn_index desc limit 1
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapTurn(rs) }
            .optional()
            .orElse(null)

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
                       intervention_note = :note
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("t", transcript)
            .param("audio", audioPath)
            .param("video", videoPath)
            .param("assessment", assessmentJson)
            .param("action", nextAction)
            .param("intervention", intervention)
            .param("note", interventionNote)
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
                select turn_index, question_text, question_audio_path, answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note
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
        )

    private fun mapTurn(rs: ResultSet) =
        TurnRow(
            turnIndex = rs.getInt("turn_index"),
            questionText = rs.getString("question_text"),
            questionAudioPath = rs.getString("question_audio_path"),
            answerTranscript = rs.getString("answer_transcript"),
            answeredAt = rs.getTimestamp("answered_at")?.toInstant(),
            intervention = rs.getString("intervention") ?: "none",
            interventionNote = rs.getString("intervention_note"),
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
)

data class TurnRow(
    val turnIndex: Int,
    val questionText: String,
    val questionAudioPath: String?,
    val answerTranscript: String?,
    val answeredAt: Instant?,
    /** What the interviewer had to supply on this turn — see Intervention. */
    val intervention: String = "none",
    val interventionNote: String? = null,
)

data class ReadinessRow(
    val companyName: String,
    val roleTitle: String,
    val endedAt: Instant?,
    val payloadJson: String,
)
