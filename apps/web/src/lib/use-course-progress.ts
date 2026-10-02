"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  fetchCourseProgress,
  importCourseProgress,
  markChapterComplete,
  markChapterIncomplete,
} from "@/lib/api";
import type { CompletedByCourse } from "@/lib/course-progress";
import { withChapter } from "@/lib/course-progress";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * Course progress, read from and written to the account.
 *
 * This used to be a `localStorage` store. It is now the API, because progress kept in a
 * browser does not follow a candidate to a second device or a lab machine — and, worse on
 * a shared computer, does not go away when they sign out. Nothing is cached in
 * `localStorage` any more for the same reason: a cache keyed by nothing would show one
 * person's progress to the next person at that desk.
 *
 * Still a module-level external store rather than context, so that ticking a chapter
 * updates the sidebar, the course page and the catalogue at once with no plumbing. The
 * snapshot object is replaced only when something actually changes, so `useSyncExternalStore`
 * can compare it by reference.
 */

export type ProgressStatus = "loading" | "ready" | "error";

interface StoreState {
  status: ProgressStatus;
  completed: CompletedByCourse;
}

const EMPTY: StoreState = { status: "loading", completed: {} };

let state: StoreState = EMPTY;
let listeners: Array<() => void> = [];
/** The token the current `state` was loaded for; a change means reload and discard. */
let loadedFor: string | null = null;
let inFlight: Promise<void> | null = null;
let generation = 0;

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

/**
 * Signing out, or signing in as somebody else, must not leave the previous account's
 * progress on screen. Exported for tests; called when the token changes.
 */
export function resetCourseProgress() {
  generation += 1;
  loadedFor = null;
  inFlight = null;
  setState(EMPTY);
}

function load(accessToken: string) {
  if (loadedFor === accessToken && inFlight === null) return;
  if (loadedFor === accessToken && inFlight) return;

  const requestGeneration = ++generation;
  loadedFor = accessToken;
  setState(EMPTY);
  const request = fetchCourseProgress({ accessToken })
    .then((view) => {
      if (generation !== requestGeneration || loadedFor !== accessToken) return;
      setState({ status: "ready", completed: view.completed ?? {} });
    })
    .catch(() => {
      if (generation !== requestGeneration || loadedFor !== accessToken) return;
      setState({ status: "error", completed: {} });
    })
    .finally(() => {
      if (generation === requestGeneration && inFlight === request) inFlight = null;
    });
  inFlight = request;
}

/** Applies a change locally at once, then persists it; reverts if the write fails. */
async function write(
  accessToken: string,
  courseSlug: string,
  chapterSlug: string,
  done: boolean,
): Promise<boolean> {
  if (loadedFor !== accessToken) return false;
  const writeGeneration = generation;
  const before = state.completed;
  const beforeStatus = state.status;
  setState({ status: "ready", completed: withChapter(before, courseSlug, chapterSlug, done) });

  try {
    if (done) await markChapterComplete(accessToken, courseSlug, chapterSlug);
    else await markChapterIncomplete(accessToken, courseSlug, chapterSlug);
    return generation === writeGeneration && loadedFor === accessToken;
  } catch {
    if (generation === writeGeneration && loadedFor === accessToken) {
      setState({ status: beforeStatus, completed: before });
    }
    return false;
  }
}

export interface CourseProgressHandle {
  completed: ReadonlySet<string>;
  status: ProgressStatus;
  /** True once we know what the account has — false while loading or signed out. */
  ready: boolean;
  /** Resolves false if the change could not be saved; the tick is reverted by then. */
  setChapterDone: (chapterSlug: string, done: boolean) => Promise<boolean>;
}

export function useCourseProgress(courseSlug: string): CourseProgressHandle {
  const accessToken = useAccessToken();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (accessToken === undefined) return;
    if (accessToken === null) {
      resetCourseProgress();
      return;
    }
    load(accessToken);
  }, [accessToken]);

  const visibleSnapshot =
    typeof accessToken === "string" && loadedFor === accessToken ? snapshot : EMPTY;

  const completed = useMemo(
    () => new Set(visibleSnapshot.completed[courseSlug] ?? []),
    [visibleSnapshot, courseSlug],
  );

  const setChapterDone = useCallback(
    async (chapterSlug: string, done: boolean) => {
      if (!accessToken) return false;
      return write(accessToken, courseSlug, chapterSlug, done);
    },
    [accessToken, courseSlug],
  );

  return {
    completed,
    status: visibleSnapshot.status,
    ready: visibleSnapshot.status === "ready",
    setChapterDone,
  };
}

/** Every course's progress at once — for the dashboard's "continue learning" card. */
export function useAllCourseProgress(): { completed: CompletedByCourse; status: ProgressStatus } {
  const accessToken = useAccessToken();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (accessToken === undefined) return;
    if (accessToken === null) {
      resetCourseProgress();
      return;
    }
    load(accessToken);
  }, [accessToken]);

  const visibleSnapshot =
    typeof accessToken === "string" && loadedFor === accessToken ? snapshot : EMPTY;
  return { completed: visibleSnapshot.completed, status: visibleSnapshot.status };
}

/**
 * Imports progress into the account, and folds the result into the store without a second
 * round trip — but only when the store still belongs to that account.
 *
 * The answer is whether the server saved it, not whether the store was updated: a store
 * nobody has loaded yet, or one that now belongs to another account, is simply left alone
 * (it reads the imported chapters from the server when it next loads). Reporting a saved
 * import as a failure would keep offering it.
 */
export async function importLegacyProgress(
  accessToken: string,
  chapters: { courseSlug: string; chapterSlug: string }[],
): Promise<boolean> {
  const importGeneration = generation;
  try {
    const view = await importCourseProgress(accessToken, { chapters });
    if (generation === importGeneration && loadedFor === accessToken) {
      setState({ status: "ready", completed: view.completed ?? {} });
    }
    return true;
  } catch {
    return false;
  }
}
