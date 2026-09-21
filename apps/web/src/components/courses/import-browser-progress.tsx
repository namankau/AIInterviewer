"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { COURSE_PROGRESS_KEY, parseProgress } from "@/lib/course-progress";
import { importLegacyProgress } from "@/lib/use-course-progress";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * Offers to import chapter ticks this browser saved before progress moved to the account.
 *
 * Deliberately asked rather than merged silently. On a shared computer — a college lab,
 * which is squarely our audience — the progress sitting in that browser may belong to
 * whoever used it last, and quietly writing it into this account would be wrong. Once the
 * candidate has answered either way the old key is cleared, so this is asked exactly once
 * per browser.
 *
 * The leftover key is read through `useSyncExternalStore` rather than in an effect: it is
 * an external system, reading it during render would break SSR, and setting state from an
 * effect is the needless extra render the hooks lint rule (rightly) rejects.
 */

let listeners: Array<() => void> = [];
/** Set once the candidate has answered, so the prompt does not come back this session. */
let answered = false;

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): string {
  if (answered) return "";
  try {
    return window.localStorage.getItem(COURSE_PROGRESS_KEY) ?? "";
  } catch {
    return ""; // Blocked or private-window storage: nothing to offer.
  }
}

/** Nothing to import during SSR or the first client render, so hydration cannot mismatch. */
function getServerSnapshot(): string {
  return "";
}

function forget() {
  answered = true;
  try {
    window.localStorage.removeItem(COURSE_PROGRESS_KEY);
  } catch {
    // If it cannot be cleared, `answered` still hides the prompt for this session.
  }
  for (const listener of listeners) listener();
}

export function ImportBrowserProgress() {
  const accessToken = useAccessToken();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const chapters = useMemo(
    () =>
      Object.entries(parseProgress(raw)).flatMap(([courseSlug, slugs]) =>
        slugs.map((chapterSlug) => ({ courseSlug, chapterSlug })),
      ),
    [raw],
  );

  async function keep() {
    if (!accessToken || chapters.length === 0) return;
    setBusy(true);
    setFailed(false);
    const ok = await importLegacyProgress(accessToken, chapters);
    setBusy(false);
    if (ok) forget();
    else setFailed(true);
  }

  if (chapters.length === 0) return null;

  return (
    <aside className="mx-auto mt-6 max-w-6xl px-6">
      <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-ink-muted">
          <span className="font-medium text-ink">
            {chapters.length} chapter{chapters.length === 1 ? "" : "s"} marked complete in this browser.
          </span>{" "}
          Progress now lives with your account. Add these to it?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={keep}
            disabled={busy || !accessToken}
            className="rounded-md bg-accent px-4 py-2 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add to my account"}
          </button>
          <button
            type="button"
            onClick={forget}
            disabled={busy}
            className="rounded-md border border-line-strong px-4 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-60"
          >
            Not mine
          </button>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          That didn&apos;t save. Check your connection and try again.
        </p>
      ) : null}
    </aside>
  );
}

/** Lets a test start from a clean slate, since `answered` is module state. */
export function resetImportPrompt() {
  answered = false;
}
