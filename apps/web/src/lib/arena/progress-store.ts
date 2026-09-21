"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  awardArenaBadges,
  fetchArenaProgress,
  importArenaProgress,
  recordArenaAnswer,
} from "@/lib/api";
import { localDateKey } from "@/lib/arena/progression";
import type { ReviewState } from "@/lib/arena/scheduler";
import type { ArenaProgress } from "@/lib/arena/storage";
import { defaultProgress } from "@/lib/arena/storage";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * Arena progress, read from and written to the account.
 *
 * This used to be `localStorage`, which meant a learner's XP, streak and review schedule
 * did not follow them to a second device or a lab machine — and, worse on a shared
 * computer, did not go away when they signed out. Nothing is cached in `localStorage` any
 * more for the same reason: a cache keyed by nobody would show one person's progress to
 * the next person at that desk.
 *
 * A module-level external store, as for course progress, so the run, the level bar and the
 * badge list all see one value without context plumbing.
 */

export type ArenaStatus = "loading" | "ready" | "error";

interface StoreState {
  status: ArenaStatus;
  progress: ArenaProgress;
}

const EMPTY: StoreState = { status: "loading", progress: defaultProgress() };

let state: StoreState = EMPTY;
let listeners: Array<() => void> = [];
let loadedFor: string | null = null;
let inFlight: Promise<void> | null = null;

function setState(next: StoreState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

/** Loading on the server and on the first client render, so hydration never mismatches. */
function getServerSnapshot(): StoreState {
  return EMPTY;
}

/** Signing out, or in as somebody else, must not leave the previous account's progress up. */
export function resetArenaProgress() {
  loadedFor = null;
  inFlight = null;
  setState(EMPTY);
}

function load(accessToken: string) {
  if (loadedFor === accessToken && inFlight === null) return;
  if (inFlight) return;

  loadedFor = accessToken;
  inFlight = fetchArenaProgress({ accessToken })
    .then((view) => {
      setState({
        status: "ready",
        progress: {
          version: 1,
          xp: view.xp,
          streak: {
            current: view.streak.current,
            longest: view.streak.longest,
            lastActiveDate: view.streak.lastActiveDate,
          },
          badges: view.badges,
          cards: view.cards as Record<string, ReviewState>,
          masteredChallengeIds: view.masteredChallengeIds,
        },
      });
    })
    .catch(() => {
      // A failed read must not read as "you have done nothing"; the run says so itself.
      setState({ status: "error", progress: state.progress });
    })
    .finally(() => {
      inFlight = null;
    });
}

function useLoadedProgress(): StoreState {
  const accessToken = useAccessToken();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (accessToken === undefined) return;
    if (accessToken === null) {
      resetArenaProgress();
      return;
    }
    if (loadedFor !== null && loadedFor !== accessToken) resetArenaProgress();
    load(accessToken);
  }, [accessToken]);

  return snapshot;
}

export interface ArenaProgressHandle {
  progress: ArenaProgress;
  status: ArenaStatus;
  ready: boolean;
  /** Resolves false if the answer could not be saved. */
  recordAnswer: (challengeId: string, correct: boolean, card: ReviewState, now?: Date) => Promise<boolean>;
  awardBadges: (badgeIds: string[]) => Promise<boolean>;
}

export function useArenaProgress(): ArenaProgressHandle {
  const accessToken = useAccessToken();
  const { status, progress } = useLoadedProgress();

  async function recordAnswer(
    challengeId: string,
    correct: boolean,
    card: ReviewState,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (!accessToken) return false;
    const before = state.progress;

    // Applied at once so the run never stalls on the network. XP and the streak are
    // the server's to decide, so what is shown here is replaced by its answer below.
    setState({
      status: "ready",
      progress: {
        ...before,
        cards: { ...before.cards, [challengeId]: card },
        masteredChallengeIds:
          correct && !before.masteredChallengeIds.includes(challengeId)
            ? [...before.masteredChallengeIds, challengeId]
            : before.masteredChallengeIds,
      },
    });

    try {
      const counters = await recordArenaAnswer(accessToken, {
        challengeId,
        correct,
        localDate: localDateKey(now),
        card,
      });
      setState({
        status: "ready",
        progress: { ...state.progress, xp: counters.xp, streak: counters.streak },
      });
      return true;
    } catch {
      setState({ status: "ready", progress: before });
      return false;
    }
  }

  async function awardBadges(badgeIds: string[]): Promise<boolean> {
    if (!accessToken || badgeIds.length === 0) return false;
    try {
      const view = await awardArenaBadges(accessToken, { badgeIds });
      setState({ status: "ready", progress: { ...state.progress, badges: view.badges } });
      return true;
    } catch {
      return false;
    }
  }

  return { progress, status, ready: status === "ready", recordAnswer, awardBadges };
}

/** Folds imported progress into the store without a second round trip. */
export async function importLegacyArenaProgress(
  accessToken: string,
  legacy: ArenaProgress,
): Promise<boolean> {
  const mastered = new Set(legacy.masteredChallengeIds);
  try {
    const view = await importArenaProgress(accessToken, {
      xp: Math.max(0, Math.round(legacy.xp)),
      streakCurrent: Math.max(0, Math.round(legacy.streak.current)),
      streakLongest: Math.max(0, Math.round(legacy.streak.longest)),
      lastActiveDate: legacy.streak.lastActiveDate,
      badgeIds: legacy.badges,
      cards: Object.entries(legacy.cards).map(([challengeId, card]) => ({
        challengeId,
        card,
        mastered: mastered.has(challengeId),
      })),
    });
    setState({
      status: "ready",
      progress: {
        version: 1,
        xp: view.xp,
        streak: view.streak,
        badges: view.badges,
        cards: view.cards as Record<string, ReviewState>,
        masteredChallengeIds: view.masteredChallengeIds,
      },
    });
    return true;
  } catch {
    return false;
  }
}
