"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CodeLanguage = "java" | "python";

const STORAGE_KEY = "course-code-language";

/**
 * A module-level external store (task 050), not React state — `localStorage` is exactly
 * the "external system" `useSyncExternalStore` exists for, and reading it inside an effect
 * just to call `setState` is the pattern the hooks lint rule (rightly) flags as a needless
 * extra render. One store for the whole app means every code block's language toggle,
 * anywhere on the page, reads and writes the same value with no context plumbing needed.
 */
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Read defensively: a private window, blocked storage, or anything else `localStorage` can
 * throw on must still render correctly (per the platform rule that browser storage is a
 * per-viewer convenience, never load-bearing state).
 */
function getSnapshot(): CodeLanguage {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "java" || stored === "python") return stored;
  } catch {
    // Falls through to the default below.
  }
  return "python";
}

/**
 * Always "python" during SSR and the first client render, so hydration never sees a
 * mismatch — `useSyncExternalStore` calls this instead of `getSnapshot` up to that point,
 * then re-renders with the real snapshot once mounted.
 */
function getServerSnapshot(): CodeLanguage {
  return "python";
}

function writeLanguage(next: CodeLanguage) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Per-viewer convenience only — a failed write just means it doesn't persist.
  }
  emitChange();
}

/**
 * Purely a naming/placement convenience — the store above is already global, so this just
 * marks "code blocks under here share one language choice" for a reader of the page tree.
 * Kept as a component (rather than deleted) so the chapter page has an obvious place to
 * wrap, and so a future per-scope need has somewhere to grow into.
 */
export function CodeLanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useCodeLanguage(): { language: CodeLanguage; setLanguage: (language: CodeLanguage) => void } {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLanguage = useCallback((next: CodeLanguage) => writeLanguage(next), []);
  return { language, setLanguage };
}
