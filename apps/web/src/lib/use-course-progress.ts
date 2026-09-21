"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  COURSE_PROGRESS_KEY,
  parseProgress,
  serializeProgress,
  withChapter,
} from "@/lib/course-progress";

/**
 * A module-level external store, as for the code-language toggle: `localStorage` is the
 * external system `useSyncExternalStore` exists for, so a chapter ticked in one component
 * updates the sidebar, the course page and the catalogue with no context plumbing. The
 * snapshot is the raw string — a primitive, so React can compare it cheaply and it stays
 * referentially stable between reads.
 */
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  // Another tab changing progress should update this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === COURSE_PROGRESS_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Never throws: blocked or private-window storage just reads as "nothing done yet". */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(COURSE_PROGRESS_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Empty on the server and on the first client render, so hydration never mismatches. */
function getServerSnapshot(): string {
  return "";
}

/** Best-effort: if storage is blocked the tick will not stick, and nothing else breaks. */
function write(raw: string) {
  try {
    window.localStorage.setItem(COURSE_PROGRESS_KEY, raw);
  } catch {
    // Storage blocked or full: progress simply is not remembered.
  }
  emitChange();
}

export function useCourseProgress(courseSlug: string): {
  completed: ReadonlySet<string>;
  setChapterDone: (chapterSlug: string, done: boolean) => void;
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const all = useMemo(() => parseProgress(raw), [raw]);
  const completed = useMemo(() => new Set(all[courseSlug] ?? []), [all, courseSlug]);

  const setChapterDone = useCallback(
    (chapterSlug: string, done: boolean) => {
      const current = parseProgress(getSnapshot());
      write(serializeProgress(withChapter(current, courseSlug, chapterSlug, done)));
    },
    [courseSlug],
  );

  return { completed, setChapterDone };
}
