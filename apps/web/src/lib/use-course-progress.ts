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
  loadedFor = null;
  inFlight = null;
  setState(EMPTY);
}

function load(accessToken: string) {
  if (loadedFor === accessToken && inFlight === null) return;
  if (inFlight) return;

  loadedFor = accessToken;
  inFlight = fetchCourseProgress({ accessToken })
    .then((view) => {
      setState({ status: "ready", completed: view.completed ?? {} });
    })
    .catch(() => {
      // Keep whatever is on screen; the tick control reports its own failures. A failed
      // read must not look like "you have completed nothing".
      setState({ status: "error", completed: state.completed });
    })
    .finally(() => {
      inFlight = null;
    });
}

/** Applies a change locally at once, then persists it; reverts if the write fails. */
async function write(
  accessToken: string,
  courseSlug: string,
  chapterSlug: string,
  done: boolean,
): Promise<boolean> {
  const before = state.completed;
  setState({ status: "ready", completed: withChapter(before, courseSlug, chapterSlug, done) });

  try {
    if (done) await markChapterComplete(accessToken, courseSlug, chapterSlug);
    else await markChapterIncomplete(accessToken, courseSlug, chapterSlug);
    return true;
  } catch {
    setState({ status: state.status, completed: before });
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
    if (loadedFor !== null && loadedFor !== accessToken) resetCourseProgress();
    load(accessToken);
  }, [accessToken]);

  const completed = useMemo(
    () => new Set(snapshot.completed[courseSlug] ?? []),
    [snapshot, courseSlug],
  );

  const setChapterDone = useCallback(
    async (chapterSlug: string, done: boolean) => {
      if (!accessToken) return false;
      return write(accessToken, courseSlug, chapterSlug, done);
    },
    [accessToken, courseSlug],
  );

  return { completed, status: snapshot.status, ready: snapshot.status === "ready", setChapterDone };
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
    if (loadedFor !== null && loadedFor !== accessToken) resetCourseProgress();
    load(accessToken);
  }, [accessToken]);

  return { completed: snapshot.completed, status: snapshot.status };
}

/** Folds imported progress into the store without a second round trip. */
export async function importLegacyProgress(
  accessToken: string,
  chapters: { courseSlug: string; chapterSlug: string }[],
): Promise<boolean> {
  try {
    const view = await importCourseProgress(accessToken, { chapters });
    setState({ status: "ready", completed: view.completed ?? {} });
    return true;
  } catch {
    return false;
  }
}
