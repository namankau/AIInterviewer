package com.interviewos.api.arena

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeParseException

/**
 * The Arena's progress: XP, streak, badges, and the spaced-repetition schedule.
 *
 * Attached to the account rather than the browser, so it follows a candidate to a second
 * device or a lab machine and is gone the moment they sign out of a shared one.
 *
 * **What is computed where, and why.** XP and the streak are decided here, from
 * [XP_PER_CORRECT] and the SQL in [ArenaProgressRepository.addAnswer], so a client cannot
 * simply post itself a level. The FSRS card is computed by the client and stored verbatim,
 * because scheduling needs `ts-fsrs` and the challenge corpus, and the corpus is derived
 * at build time from static course content that this service has never seen. Badges are
 * likewise client-decided — whether a module is fully mastered is a question about that
 * same corpus — but the id is checked against [KNOWN_BADGES] so an arbitrary string can
 * never be stored. That is a deliberate, bounded amount of client trust in a personal
 * learning tool with no leaderboard and nothing to win; it would not be acceptable if
 * either of those changed.
 */
@RestController
@RequestMapping("/api/v1/me/arena")
class ArenaController(
    private val repository: ArenaProgressRepository,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun progress(
        @AuthenticationPrincipal jwt: Jwt,
    ): ArenaProgressView = view(SupabaseIdentity.from(jwt).id)

    /** Records one answered challenge and returns the counters the server now holds. */
    @PostMapping("/answers")
    fun answer(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: RecordAnswerRequest,
    ): ArenaCountersView {
        val identity = SupabaseIdentity.from(jwt)
        val challengeId = requireId(request.challengeId, "challengeId")
        val localDate = requireLocalDate(request.localDate)
        val card = request.card ?: throw ApiException.badRequest("card is required.")

        userRepository.provision(identity)
        repository.upsertCard(identity.id, card.toStored(challengeId, mastered = request.correct))
        val counters = repository.addAnswer(identity.id, if (request.correct) XP_PER_CORRECT else 0, localDate)
        return counters.toView()
    }

    /** Awards badges the client has determined were earned, filtered to ones we define. */
    @PostMapping("/badges")
    fun award(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: AwardBadgesRequest,
    ): ArenaBadgesView {
        val identity = SupabaseIdentity.from(jwt)
        val unknown = request.badgeIds.filterNot { it in KNOWN_BADGES }
        if (unknown.isNotEmpty()) throw ApiException.badRequest("Unknown badge: ${unknown.first()}.")

        userRepository.provision(identity)
        repository.awardBadges(identity.id, request.badgeIds)
        return ArenaBadgesView(badges = repository.badges(identity.id))
    }

    /**
     * Imports progress a candidate had in a browser before this was account-backed.
     *
     * A union, never a replacement. The client asks the candidate first — on a shared
     * computer that progress may not be theirs, so it is never merged silently.
     */
    @PostMapping("/import")
    fun import(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: ImportArenaProgressRequest,
    ): ArenaProgressView {
        val identity = SupabaseIdentity.from(jwt)
        if (request.cards.size > MAX_IMPORT_CARDS) {
            throw ApiException.badRequest("Cannot import more than $MAX_IMPORT_CARDS cards at once.")
        }
        if (request.xp < 0 || request.streakCurrent < 0 || request.streakLongest < 0) {
            throw ApiException.badRequest("Counters cannot be negative.")
        }

        val cards =
            request.cards.map { entry ->
                entry.card.toStored(requireId(entry.challengeId, "challengeId"), mastered = entry.mastered)
            }

        userRepository.provision(identity)
        repository.importProgress(
            userId = identity.id,
            xp = request.xp,
            streakCurrent = request.streakCurrent,
            streakLongest = request.streakLongest,
            lastActiveDate = request.lastActiveDate?.let { requireLocalDate(it) },
            badgeIds = request.badgeIds.filter { it in KNOWN_BADGES },
            cards = cards,
        )
        return view(identity.id)
    }

    private fun view(userId: java.util.UUID): ArenaProgressView {
        val counters = repository.counters(userId)
        val cards = repository.cards(userId)
        return ArenaProgressView(
            xp = counters?.xp ?: 0,
            streak =
                ArenaStreakView(
                    current = counters?.streakCurrent ?: 0,
                    longest = counters?.streakLongest ?: 0,
                    lastActiveDate = counters?.lastActiveDate?.toString(),
                ),
            badges = repository.badges(userId),
            cards = cards.associate { it.challengeId to it.toView() },
            masteredChallengeIds = cards.filter { it.mastered }.map { it.challengeId },
        )
    }

    private fun requireId(
        value: String,
        field: String,
    ): String {
        val trimmed = value.trim()
        if (trimmed.isEmpty() || trimmed.length > 200) throw ApiException.badRequest("$field must be 1-200 characters.")
        return trimmed
    }

    /**
     * The candidate's own calendar date, as `YYYY-MM-DD`. Parsed rather than derived from
     * the server clock: a streak is a question about the learner's days, and a server in
     * UTC would break the boundary for everybody east of it.
     */
    private fun requireLocalDate(value: String): LocalDate =
        try {
            LocalDate.parse(value)
        } catch (_: DateTimeParseException) {
            throw ApiException.badRequest("localDate must be an ISO date (YYYY-MM-DD).")
        }

    companion object {
        /**
         * Flat XP for a correct answer, and the authority for what is stored — the web
         * app's own copy of this number only labels the "+XP" shown during a run.
         */
        const val XP_PER_CORRECT = 10

        /** Mirrors BADGES in `apps/web/src/lib/arena/progression.ts`. */
        val KNOWN_BADGES = setOf("streak-7", "chapter-clean", "module-complete")

        private const val MAX_IMPORT_CARDS = 5_000
    }
}

private fun Counters.toView() =
    ArenaCountersView(
        xp = xp,
        streak = ArenaStreakView(current = streakCurrent, longest = streakLongest, lastActiveDate = lastActiveDate?.toString()),
    )

private fun StoredCard.toView() =
    ReviewStateView(
        due = due.toString(),
        stability = stability,
        difficulty = difficulty,
        scheduledDays = scheduledDays,
        learningSteps = learningSteps,
        reps = reps,
        lapses = lapses,
        state = state,
        lastReview = lastReview?.toString(),
    )

private fun ReviewStateView.toStored(
    challengeId: String,
    mastered: Boolean,
) = StoredCard(
    challengeId = challengeId,
    due = parseInstant(due, "card.due"),
    stability = stability,
    difficulty = difficulty,
    scheduledDays = scheduledDays,
    learningSteps = learningSteps,
    reps = reps,
    lapses = lapses,
    state = state.coerceIn(0, 3),
    lastReview = lastReview?.let { parseInstant(it, "card.lastReview") },
    mastered = mastered,
)

/** A malformed instant is the client's mistake, so it is a 400 rather than a 500. */
private fun parseInstant(
    value: String,
    field: String,
): Instant =
    try {
        Instant.parse(value)
    } catch (_: DateTimeParseException) {
        throw ApiException.badRequest("$field must be an ISO-8601 instant.")
    }

/** Mirrors `ReviewState` in `apps/web/src/lib/arena/scheduler.ts`. */
data class ReviewStateView(
    val due: String,
    val stability: Double,
    val difficulty: Double,
    val scheduledDays: Int,
    val learningSteps: Int,
    val reps: Int,
    val lapses: Int,
    val state: Int,
    val lastReview: String?,
)

data class ArenaStreakView(
    val current: Int,
    val longest: Int,
    val lastActiveDate: String?,
)

data class ArenaCountersView(
    val xp: Int,
    val streak: ArenaStreakView,
)

data class ArenaBadgesView(
    val badges: List<String>,
)

data class ArenaProgressView(
    val xp: Int,
    val streak: ArenaStreakView,
    val badges: List<String>,
    val cards: Map<String, ReviewStateView>,
    val masteredChallengeIds: List<String>,
)

data class RecordAnswerRequest(
    val challengeId: String = "",
    val correct: Boolean = false,
    val localDate: String = "",
    val card: ReviewStateView? = null,
)

data class AwardBadgesRequest(
    val badgeIds: List<String> = emptyList(),
)

data class ImportedCard(
    val challengeId: String,
    val card: ReviewStateView,
    val mastered: Boolean = false,
)

data class ImportArenaProgressRequest(
    val xp: Int = 0,
    val streakCurrent: Int = 0,
    val streakLongest: Int = 0,
    val lastActiveDate: String? = null,
    val badgeIds: List<String> = emptyList(),
    val cards: List<ImportedCard> = emptyList(),
)
