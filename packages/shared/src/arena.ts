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
  /** Recent local calendar dates mapped to the daily challenge solved on that date. */
  dailyQuestionCompletions: Record<string, string>;
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
  /** Present only for the dashboard daily question; the API records it only when correct. */
  dailyQuestionDate?: string;
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

/** Authored, server-graded scenario Arena. Answer keys appear only after grading. */
export interface ScenarioOption { id: string; text: string }
export interface ScenarioPublicView {
  id: string; courseId: string; title: string; hook: string; context: string;
  tier: string; estimatedMinutes: number;
}
export interface ScenarioStepView {
  id: string; position: number; kind: "initial" | "probe"; stepType: string;
  prompt: string; contextNote: string | null; options: ScenarioOption[];
  codeSnippet: string | null; language: string | null;
}
export interface ScenarioPlayView { scenario: ScenarioPublicView | null; step: ScenarioStepView | null }
export interface ScenarioAnswerView {
  correct: boolean; correctOptionId: string; explanation: string; bottleneckNote: string;
  nextStep: ScenarioStepView | null; solutionBrief: string | null; conceptsCovered: string[];
}
export interface ScenarioCourseProgressView {
  scenariosDone: number; activeScenarioId: string | null; unlockedTier: number;
  weakestConcepts: { id: string; name: string; score: number }[];
}
