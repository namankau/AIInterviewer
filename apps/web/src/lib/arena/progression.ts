import { cyrb53, mulberry32, shuffle } from "@/lib/arena/hash";
import type { StreakState } from "@/lib/arena/storage";
import type { Challenge } from "@/lib/arena/types";

/**
 * XP, levels, streaks, badges and the daily quest (task 055, §2). None of this needs a
 * library — each is 50-100 lines against our own data model, per the research pass in the
 * task file — but every number that matters is named here, once, rather than scattered as
 * magic numbers through the UI.
 */

// ---------------------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------------------

/** Flat XP for a correct answer. No streak multiplier, no "bonus round" — a number that
 * varies by outcome the learner can't see coming is closer to a slot machine than to
 * honest progress (CLAUDE.md: no dark patterns). */
export const XP_PER_CORRECT = 10;

/**
 * The level curve: level `n` requires `50 * n^2` total XP, so it costs progressively more
 * to level up — 50 XP for level 1, 200 for level 2, 450 for level 3, and so on. One named
 * constant (`LEVEL_XP_FACTOR`) rather than a hand-tuned table, so the shape of the curve
 * is visible at a glance instead of implied by 30 rows of numbers.
 */
export const LEVEL_XP_FACTOR = 50;

export function xpForLevel(level: number): number {
  return LEVEL_XP_FACTOR * level * level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** The learner's level for a total XP amount, and how far into it they are — everything
 * a progress bar needs, with no arithmetic left for the component that renders it. */
export function levelForXp(totalXp: number): LevelProgress {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXp) {
    level += 1;
  }
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return { level, xpIntoLevel: totalXp - floor, xpForNextLevel: ceiling - floor };
}

// ---------------------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------------------

/**
 * The learner's calendar date, in a given timezone, as `YYYY-MM-DD`. Defaults to the
 * runtime's own local timezone (the user's, in a browser) — this is the one function a
 * streak day boundary must never get wrong. It uses `Intl.DateTimeFormat` rather than
 * UTC getters specifically so a test can pin the timezone and prove the boundary lands on
 * the right calendar day instead of the UTC one (the "5:30am IST" bug this exists to
 * prevent).
 */
export function localDateKey(date: Date, timeZone?: string): string {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // en-CA formats as YYYY-MM-DD, which is both what we want to store and sorts correctly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rolls the streak forward for activity happening "now". Idempotent within a single
 * calendar day: playing three rounds on the same day advances the streak once, not three
 * times. A gap of exactly one calendar day extends it; any bigger gap resets to 1.
 */
export function recordActivity(streak: StreakState, now: Date = new Date(), timeZone?: string): StreakState {
  const today = localDateKey(now, timeZone);
  if (streak.lastActiveDate === today) return streak;

  const yesterday = localDateKey(new Date(now.getTime() - ONE_DAY_MS), timeZone);
  const current = streak.lastActiveDate === yesterday ? streak.current + 1 : 1;
  return { current, longest: Math.max(streak.longest, current), lastActiveDate: today };
}

// ---------------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------------

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDefinition[] = [
  { id: "streak-7", title: "Seven-day streak", description: "Practised seven days in a row." },
  {
    id: "chapter-clean",
    title: "Chapter cleared",
    description: "Answered every derived challenge from at least one chapter correctly.",
  },
  {
    id: "module-complete",
    title: "Module complete",
    description: "Answered every derived challenge from an entire module correctly.",
  },
];

export interface BadgeCheckInput {
  streak: StreakState;
  masteredChallengeIds: string[];
  /** The full derived corpus, needed to know which challenges belong to which
   * chapter/module — badges are checked against real coverage, never a raw count. */
  allChallenges: Challenge[];
}

/** Which badges are newly earned, given the learner's current state. Returns only badges
 * not already in `alreadyEarned`, so the caller can award them once and celebrate once. */
export function checkNewBadges(input: BadgeCheckInput, alreadyEarned: string[]): BadgeDefinition[] {
  const earned = new Set(alreadyEarned);
  const mastered = new Set(input.masteredChallengeIds);
  const newlyEarned: BadgeDefinition[] = [];

  const award = (id: string) => {
    if (earned.has(id)) return;
    const def = BADGES.find((b) => b.id === id);
    if (def) newlyEarned.push(def);
  };

  if (input.streak.current >= 7) award("streak-7");

  const chaptersDone = new Set<string>();
  const byChapter = new Map<string, Challenge[]>();
  const byModule = new Map<string, Challenge[]>();
  for (const challenge of input.allChallenges) {
    const chapterKey = `${challenge.courseSlug}/${challenge.chapterSlug}`;
    const moduleKey = `${challenge.courseSlug}/${challenge.moduleTitle}`;
    (byChapter.get(chapterKey) ?? byChapter.set(chapterKey, []).get(chapterKey)!).push(challenge);
    (byModule.get(moduleKey) ?? byModule.set(moduleKey, []).get(moduleKey)!).push(challenge);
  }

  for (const [key, list] of byChapter) {
    if (list.every((c) => mastered.has(c.id))) chaptersDone.add(key);
  }
  if (chaptersDone.size > 0) award("chapter-clean");

  for (const [, list] of byModule) {
    if (list.length > 0 && list.every((c) => mastered.has(c.id))) {
      award("module-complete");
      break;
    }
  }

  return newlyEarned;
}

// ---------------------------------------------------------------------------------------
// Daily quest
// ---------------------------------------------------------------------------------------

/** How many challenges make up one daily quest — enough to feel like a real round, short
 * enough to finish in the "3-5 minutes" a session is meant to take (task 055, §1). */
export const DAILY_QUEST_SIZE = 7;

/**
 * The same fixed set of challenges for everyone on a given calendar day, seeded
 * deterministically from the date string alone — refreshing the page, or opening it on a
 * different device, must show the identical quest. `dateKey` is a plain `YYYY-MM-DD`
 * (typically `localDateKey(new Date())`), not a `Date`, so the caller decides once what
 * "today" means and every call this module makes agrees with it.
 */
export function dailyQuest(allChallenges: Challenge[], dateKey: string): Challenge[] {
  if (allChallenges.length === 0) return [];
  const rng = mulberry32(cyrb53(`daily-quest|${dateKey}`) >>> 0);
  const shuffled = shuffle(allChallenges, rng);
  return shuffled.slice(0, Math.min(DAILY_QUEST_SIZE, shuffled.length));
}
