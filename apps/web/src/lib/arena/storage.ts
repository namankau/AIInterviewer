import type { ReviewState } from "@/lib/arena/scheduler";

/**
 * The shape of Arena progress, and the reader for the `localStorage` key it used before
 * it moved to the account.
 *
 * The store is now the API (`progress-store.ts`): progress kept in a browser does not
 * follow a learner to a second device or a lab machine, and does not go away when they
 * sign out of a shared one. What is left here is the type, the defaults, and a defensive
 * reader so a learner can import what this browser already holds. Every read and write is
 * wrapped in try/catch: a private window, blocked site data, or a disabled `localStorage`
 * must never break the page.
 */

/** The key Arena progress used before it moved to the account. Read, never written. */
export const ARENA_STORAGE_KEY = "arena:v1";

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
 * Accepts anything that has ever been written under `ARENA_STORAGE_KEY`, including malformed
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

/**
 * Parses a raw stored value into progress, or null when there is nothing usable there.
 * Used by the one-off import: `loadProgress` cannot tell "absent" from "empty", and the
 * import prompt must not offer to import nothing.
 */
export function parseStoredProgress(raw: string | null | undefined): ArenaProgress | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return migrate(parsed);
  } catch {
    return null;
  }
}

/** Reads progress from `localStorage`. Never throws — a throwing or unavailable
 * `localStorage`, corrupt JSON, or a missing key all degrade to `defaultProgress()`. */
export function loadProgress(): ArenaProgress {
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultProgress();
    const raw = window.localStorage.getItem(ARENA_STORAGE_KEY);
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
    window.localStorage.setItem(ARENA_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private window, blocked site data, quota exceeded — progress just isn't saved.
  }
}
