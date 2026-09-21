/**
 * Arena progress, owned by the account rather than the browser.
 *
 * XP and the streak are decided by the server; the spaced-repetition card is computed by
 * the client, because scheduling needs `ts-fsrs` and the challenge corpus, and that corpus
 * is derived at build time from static course content the API has never seen.
 */

/** Mirrors `ReviewState` in `apps/web/src/lib/arena/scheduler.ts`. */
export interface ReviewStateView {
  /** ISO-8601 instant. */
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  /** ts-fsrs `State`: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state: number;
  /** ISO-8601 instant, or null before the first review. */
  lastReview: string | null;
}

export interface ArenaStreakView {
  current: number;
  longest: number;
  /** The candidate's own calendar date (`YYYY-MM-DD`), never a UTC one. */
  lastActiveDate: string | null;
}

/** `GET /api/v1/me/arena`. */
export interface ArenaProgressView {
  xp: number;
  streak: ArenaStreakView;
  badges: string[];
  cards: Record<string, ReviewStateView>;
  masteredChallengeIds: string[];
}

/** `POST /api/v1/me/arena/answers` returns only what the server decides. */
export interface ArenaCountersView {
  xp: number;
  streak: ArenaStreakView;
}

export interface ArenaBadgesView {
  badges: string[];
}

export interface RecordAnswerRequest {
  challengeId: string;
  correct: boolean;
  /** The learner's own calendar date, so the streak boundary is their midnight. */
  localDate: string;
  card: ReviewStateView;
}

export interface AwardBadgesRequest {
  badgeIds: string[];
}

export interface ImportedArenaCard {
  challengeId: string;
  card: ReviewStateView;
  mastered: boolean;
}

/** `POST /api/v1/me/arena/import` — a one-off union of progress saved in this browser. */
export interface ImportArenaProgressRequest {
  xp: number;
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
  badgeIds: string[];
  cards: ImportedArenaCard[];
}
