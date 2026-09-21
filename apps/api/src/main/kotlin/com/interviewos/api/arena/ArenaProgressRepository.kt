package com.interviewos.api.arena

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * Arena progress: the counters, the badges earned, and one spaced-repetition card per
 * challenge the candidate has answered.
 *
 * Every method takes the user id the caller derived from a verified token; none accepts
 * it from a request body, so one candidate can never read or write another's progress.
 */
@Repository
class ArenaProgressRepository(
    private val jdbcClient: JdbcClient,
) {
    fun counters(userId: UUID): Counters? =
        jdbcClient
            .sql(
                """
                select xp, streak_current, streak_longest, last_active_date
                from public.arena_progress
                where user_id = :userId
                """.trimIndent(),
            ).param("userId", userId)
            .query { rs, _ ->
                Counters(
                    xp = rs.getInt("xp"),
                    streakCurrent = rs.getInt("streak_current"),
                    streakLongest = rs.getInt("streak_longest"),
                    lastActiveDate = rs.getDate("last_active_date")?.toLocalDate(),
                )
            }.optional()
            .orElse(null)

    fun badges(userId: UUID): List<String> =
        jdbcClient
            .sql("select badge_id from public.arena_badges where user_id = :userId order by earned_at, badge_id")
            .param("userId", userId)
            .query { rs, _ -> rs.getString("badge_id") }
            .list()

    fun cards(userId: UUID): List<StoredCard> =
        jdbcClient
            .sql(
                """
                select challenge_id, due, stability, difficulty, scheduled_days, learning_steps,
                       reps, lapses, state, last_review, mastered
                from public.arena_cards
                where user_id = :userId
                """.trimIndent(),
            ).param("userId", userId)
            .query { rs, _ ->
                StoredCard(
                    challengeId = rs.getString("challenge_id"),
                    due = rs.getTimestamp("due").toInstant(),
                    stability = rs.getDouble("stability"),
                    difficulty = rs.getDouble("difficulty"),
                    scheduledDays = rs.getInt("scheduled_days"),
                    learningSteps = rs.getInt("learning_steps"),
                    reps = rs.getInt("reps"),
                    lapses = rs.getInt("lapses"),
                    state = rs.getInt("state"),
                    lastReview = rs.getTimestamp("last_review")?.toInstant(),
                    mastered = rs.getBoolean("mastered"),
                )
            }.list()

    /**
     * Records one answered challenge: the new card, and — when it was right — that the
     * challenge is now mastered.
     *
     * `mastered` is only ever set true, never back to false: a later wrong answer means
     * the card is due again sooner, which FSRS already expresses, not that the candidate
     * has un-learnt it.
     */
    fun upsertCard(
        userId: UUID,
        card: StoredCard,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.arena_cards (
                  user_id, challenge_id, due, stability, difficulty, scheduled_days,
                  learning_steps, reps, lapses, state, last_review, mastered
                ) values (
                  :userId, :challengeId, :due, :stability, :difficulty, :scheduledDays,
                  :learningSteps, :reps, :lapses, :state, :lastReview, :mastered
                )
                on conflict (user_id, challenge_id) do update set
                  due = excluded.due,
                  stability = excluded.stability,
                  difficulty = excluded.difficulty,
                  scheduled_days = excluded.scheduled_days,
                  learning_steps = excluded.learning_steps,
                  reps = excluded.reps,
                  lapses = excluded.lapses,
                  state = excluded.state,
                  last_review = excluded.last_review,
                  mastered = public.arena_cards.mastered or excluded.mastered
                """.trimIndent(),
            ).param("userId", userId)
            .param("challengeId", card.challengeId)
            .param("due", java.sql.Timestamp.from(card.due))
            .param("stability", card.stability)
            .param("difficulty", card.difficulty)
            .param("scheduledDays", card.scheduledDays)
            .param("learningSteps", card.learningSteps)
            .param("reps", card.reps)
            .param("lapses", card.lapses)
            .param("state", card.state)
            .param("lastReview", card.lastReview?.let { java.sql.Timestamp.from(it) })
            .param("mastered", card.mastered)
            .update()
    }

    /**
     * Adds XP and rolls the streak forward, in one statement so two answers submitted at
     * once cannot each read the same starting value and lose one of the increments.
     *
     * The streak rules, expressed in SQL so they hold regardless of which client called:
     * same calendar day is idempotent, exactly one day later extends, anything else
     * restarts at 1. The date is the candidate's own local one — see the migration.
     */
    fun addAnswer(
        userId: UUID,
        xpGain: Int,
        localDate: LocalDate,
    ): Counters {
        jdbcClient
            .sql(
                """
                insert into public.arena_progress (user_id, xp, streak_current, streak_longest, last_active_date, updated_at)
                values (:userId, :xpGain, 1, 1, :localDate, now())
                on conflict (user_id) do update set
                  xp = public.arena_progress.xp + :xpGain,
                  streak_current = case
                    when public.arena_progress.last_active_date = :localDate then public.arena_progress.streak_current
                    when public.arena_progress.last_active_date = (:localDate::date - 1) then public.arena_progress.streak_current + 1
                    else 1
                  end,
                  streak_longest = greatest(
                    public.arena_progress.streak_longest,
                    case
                      when public.arena_progress.last_active_date = :localDate then public.arena_progress.streak_current
                      when public.arena_progress.last_active_date = (:localDate::date - 1) then public.arena_progress.streak_current + 1
                      else 1
                    end
                  ),
                  last_active_date = greatest(public.arena_progress.last_active_date, :localDate),
                  updated_at = now()
                """.trimIndent(),
            ).param("userId", userId)
            .param("xpGain", xpGain)
            .param("localDate", java.sql.Date.valueOf(localDate))
            .update()

        return counters(userId) ?: Counters(xpGain, 1, 1, localDate)
    }

    /** Awards badges, ignoring any already held. */
    fun awardBadges(
        userId: UUID,
        badgeIds: List<String>,
    ) {
        for (badgeId in badgeIds) {
            jdbcClient
                .sql(
                    """
                    insert into public.arena_badges (user_id, badge_id)
                    values (:userId, :badgeId)
                    on conflict (user_id, badge_id) do nothing
                    """.trimIndent(),
                ).param("userId", userId)
                .param("badgeId", badgeId)
                .update()
        }
    }

    /**
     * Folds progress from a browser into the account, for the one-off import.
     *
     * Never destructive: XP takes the larger of the two rather than the sum, so importing
     * twice cannot inflate it, and a card already on the account is left alone rather than
     * overwritten by a possibly older one from the browser.
     */
    fun importProgress(
        userId: UUID,
        xp: Int,
        streakCurrent: Int,
        streakLongest: Int,
        lastActiveDate: LocalDate?,
        badgeIds: List<String>,
        cards: List<StoredCard>,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.arena_progress (user_id, xp, streak_current, streak_longest, last_active_date, updated_at)
                values (:userId, :xp, :streakCurrent, :streakLongest, :lastActiveDate, now())
                on conflict (user_id) do update set
                  xp = greatest(public.arena_progress.xp, :xp),
                  streak_current = greatest(public.arena_progress.streak_current, :streakCurrent),
                  streak_longest = greatest(public.arena_progress.streak_longest, :streakLongest),
                  last_active_date = greatest(public.arena_progress.last_active_date, :lastActiveDate),
                  updated_at = now()
                """.trimIndent(),
            ).param("userId", userId)
            .param("xp", xp)
            .param("streakCurrent", streakCurrent)
            .param("streakLongest", streakLongest)
            .param("lastActiveDate", lastActiveDate?.let { java.sql.Date.valueOf(it) })
            .update()

        awardBadges(userId, badgeIds)

        for (card in cards) {
            jdbcClient
                .sql(
                    """
                    insert into public.arena_cards (
                      user_id, challenge_id, due, stability, difficulty, scheduled_days,
                      learning_steps, reps, lapses, state, last_review, mastered
                    ) values (
                      :userId, :challengeId, :due, :stability, :difficulty, :scheduledDays,
                      :learningSteps, :reps, :lapses, :state, :lastReview, :mastered
                    )
                    on conflict (user_id, challenge_id) do update set
                      mastered = public.arena_cards.mastered or excluded.mastered
                    """.trimIndent(),
                ).param("userId", userId)
                .param("challengeId", card.challengeId)
                .param("due", java.sql.Timestamp.from(card.due))
                .param("stability", card.stability)
                .param("difficulty", card.difficulty)
                .param("scheduledDays", card.scheduledDays)
                .param("learningSteps", card.learningSteps)
                .param("reps", card.reps)
                .param("lapses", card.lapses)
                .param("state", card.state)
                .param("lastReview", card.lastReview?.let { java.sql.Timestamp.from(it) })
                .param("mastered", card.mastered)
                .update()
        }
    }
}

data class Counters(
    val xp: Int,
    val streakCurrent: Int,
    val streakLongest: Int,
    val lastActiveDate: LocalDate?,
)

data class StoredCard(
    val challengeId: String,
    val due: Instant,
    val stability: Double,
    val difficulty: Double,
    val scheduledDays: Int,
    val learningSteps: Int,
    val reps: Int,
    val lapses: Int,
    val state: Int,
    val lastReview: Instant?,
    val mastered: Boolean,
)
