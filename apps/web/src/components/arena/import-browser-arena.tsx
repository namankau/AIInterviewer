"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { importLegacyArenaProgress } from "@/lib/arena/progress-store";
import { ARENA_STORAGE_KEY, parseStoredProgress } from "@/lib/arena/storage";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * Offers to import Arena progress this browser saved before it moved to the account.
 *
 * Asked, never merged silently — the same reason as the course version. On a shared
 * computer, which a college lab is, the XP and streak sitting in that browser may belong
 * to whoever used it last, and quietly claiming them would be wrong.
 *
 * Read through `useSyncExternalStore` rather than an effect: it is an external system,
 * reading it during render would break SSR, and setting state from an effect is the
 * needless extra render the hooks lint rule rejects.
 */

let listeners: Array<() => void> = [];
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
    return window.localStorage.getItem(ARENA_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function forget() {
  answered = true;
  try {
    window.localStorage.removeItem(ARENA_STORAGE_KEY);
  } catch {
    // If it cannot be cleared, `answered` still hides the prompt for this session.
  }
  for (const listener of listeners) listener();
}

export function ImportBrowserArenaProgress() {
  const accessToken = useAccessToken();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const legacy = useMemo(() => parseStoredProgress(raw), [raw]);
  const hasSomething = legacy !== null && (legacy.xp > 0 || Object.keys(legacy.cards).length > 0);

  async function keep() {
    if (!accessToken || !legacy) return;
    setBusy(true);
    setFailed(false);
    const ok = await importLegacyArenaProgress(accessToken, legacy);
    setBusy(false);
    if (ok) forget();
    else setFailed(true);
  }

  if (!hasSomething || !legacy) return null;

  const answeredCount = Object.keys(legacy.cards).length;

  return (
    <aside className="mt-6">
      <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-ink-muted">
          <span className="font-medium text-ink">
            {legacy.xp} XP and {answeredCount} answered challenge{answeredCount === 1 ? "" : "s"} saved in this browser.
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
export function resetArenaImportPrompt() {
  answered = false;
}
