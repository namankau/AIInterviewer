"use client";

import { useCallback, useState } from "react";

import { ArenaSession } from "@/components/arena/arena-session";
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
  startLabel,
  emptyLabel,
}: {
  challenges: Challenge[];
  courseSlug?: string;
  startLabel: string;
  emptyLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const playAgain = useCallback(() => setSessionKey((k) => k + 1), []);

  if (challenges.length === 0) {
    return <p className="text-body text-ink-muted">{emptyLabel ?? "Nothing to practise here yet."}</p>;
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="self-start rounded-md bg-accent px-6 py-3 text-body font-medium text-white transition-colors hover:bg-accent-strong"
      >
        {startLabel}
      </button>
    );
  }

  // `key` changes on "play again" so the whole run remounts from scratch rather than the
  // finished session lingering — the result screen's "play again" calls `playAgain`
  // instead of navigating, since navigating to the same route doesn't force a remount.
  return <ArenaSession challenges={challenges} courseSlug={courseSlug} onPlayAgain={playAgain} key={sessionKey} />;
}
