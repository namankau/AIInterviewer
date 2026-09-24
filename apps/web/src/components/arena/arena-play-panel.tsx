"use client";

import { useCallback, useState } from "react";

import { ArenaSession } from "@/components/arena/arena-session";
import { useArenaProgress } from "@/lib/arena/progress-store";
import type { Challenge } from "@/lib/arena/types";

/**
 * Toggles between a "start" call to action and the run itself, in place — no route
 * change, so leaving mid-run and coming back to the campaign map is one click either way.
 * Used both for a course's "start practice" and the landing page's daily quest, which
 * differ only in which `challenges` they're handed.
 */
export function ArenaPlayPanel({
  challenges,
  courseSlug,
  selectionMode = "scheduled",
  startLabel,
  emptyLabel,
}: {
  challenges: Challenge[];
  courseSlug?: string;
  selectionMode?: "scheduled" | "fixed";
  startLabel: string;
  emptyLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  // The run picks its challenges from the review schedule at the moment it mounts, so it
  // must not start before the account's schedule has arrived — otherwise a returning
  // learner gets a run of brand-new questions and their due reviews are silently skipped.
  const { ready, status } = useArenaProgress();

  const playAgain = useCallback(() => setSessionKey((k) => k + 1), []);

  if (challenges.length === 0) {
    return <p className="text-body text-ink-muted">{emptyLabel ?? "Nothing to practise here yet."}</p>;
  }

  if (!playing) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => setPlaying(true)}
          className="self-start rounded-xl bg-accent px-6 py-3 text-body font-medium text-accent-contrast shadow-[var(--shadow-sm)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-accent-strong disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {ready ? startLabel : "Loading your progress…"}
        </button>
        {status === "error" ? (
          <p role="alert" className="text-caption text-danger">
            We couldn&apos;t load your progress. Reload the page to try again.
          </p>
        ) : null}
      </div>
    );
  }

  // `key` changes on "play again" so the whole run remounts from scratch rather than the
  // finished session lingering — the result screen's "play again" calls `playAgain`
  // instead of navigating, since navigating to the same route doesn't force a remount.
  return (
    <ArenaSession
      challenges={challenges}
      courseSlug={courseSlug}
      selectionMode={selectionMode}
      onPlayAgain={playAgain}
      key={sessionKey}
    />
  );
}
