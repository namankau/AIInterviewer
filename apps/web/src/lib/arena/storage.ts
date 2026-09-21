import type { ReviewState } from "@/lib/arena/scheduler";

/**
 * Arena progress lives in `localStorage` for this task (task 055, §5 — no account sync
 * yet, that is task 056 and goes through a PR because it touches user data and RLS).
 * Every read and write is wrapped in try/catch: a private window, blocked site data, or a
 * disabled `localStorage` must never break the page, only mean progress isn't remembered.
 */

const STORAGE_KEY = "arena:v1";

export interface StreakState {
  current: number;
  longest: number;
  /** YYYY-MM-DD in the learner's local timezone at the moment of last activity, or `null`
   * before their first session. Never a UTC date — see `progression.ts`. */
  lastActiveDate: string | null;
}

export interface ArenaProgress {
  version: 1;
  xp: number;
  streak: StreakState;
  /** Badge ids the learner has actually earned, each corresponding to a real, checkable
   * event — never a participation trophy. */
  badges: string[];
  /** One FSRS review card per challenge id the learner has ever answered. */
  cards: Record<string, ReviewState>;
  /** Challenge ids the learner has answered correctly at least once — the basis for the
   * "chapter/module complete" badges, since a single right answer is mastery enough to
   * count without requiring a flawless single sitting. */
  masteredChallengeIds: string[];
}

export function defaultProgress(): ArenaProgress {
  return {
    version: 1,
    xp: 0,
    streak: { current: 0, longest: 0, lastActiveDate: null },
    badges: [],
    cards: {},
    masteredChallengeIds: [],
  };
}

/**
 * Accepts anything that has ever been written under `STORAGE_KEY`, including malformed
 * JSON, a future/unknown version, or a stray `null`, and always returns a well-formed
 * `ArenaProgress`. There is only one schema version so far; this is the seam a version 2
 * migration plugs into later, rather than a rewrite of every call site.
 */
function migrate(raw: unknown): ArenaProgress {
  if (!raw || typeof raw !== "object") return defaultProgress();
  const obj = raw as Partial<ArenaProgress> & Record<string, unknown>;
  if (obj.version !== 1) return defaultProgress();

  const fallback = defaultProgress();
  return {
    version: 1,
    xp: typeof obj.xp === "number" && Number.isFinite(obj.xp) ? obj.xp : fallback.xp,
    streak:
      obj.streak && typeof obj.streak === "object"
        ? {
            current: typeof obj.streak.current === "number" ? obj.streak.current : 0,
            longest: typeof obj.streak.longest === "number" ? obj.streak.longest : 0,
            lastActiveDate: typeof obj.streak.lastActiveDate === "string" ? obj.streak.lastActiveDate : null,
          }
        : fallback.streak,
    badges: Array.isArray(obj.badges) ? obj.badges.filter((b): b is string => typeof b === "string") : [],
    cards: obj.cards && typeof obj.cards === "object" ? (obj.cards as Record<string, ReviewState>) : {},
    masteredChallengeIds: Array.isArray(obj.masteredChallengeIds)
      ? obj.masteredChallengeIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

/** Reads progress from `localStorage`. Never throws — a throwing or unavailable
 * `localStorage`, corrupt JSON, or a missing key all degrade to `defaultProgress()`. */
export function loadProgress(): ArenaProgress {
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultProgress();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultProgress();
  }
}

/** Writes progress to `localStorage`. Never throws — if storage is blocked or full, the
 * write is silently dropped and the session continues with in-memory state only. */
export function saveProgress(progress: ArenaProgress): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private window, blocked site data, quota exceeded — progress just isn't saved.
  }
}
