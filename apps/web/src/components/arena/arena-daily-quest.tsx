"use client";

import { useState } from "react";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import { dailyQuest, localDateKey } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

/**
 * Today's fixed set — the same 7 challenges for every visitor today, seeded from the
 * calendar date (task 055, §2). Computed on the client (not the server component around
 * it) only because "today" has to mean the visitor's own calendar day, not the server's.
 */
export function ArenaDailyQuest({ allChallenges }: { allChallenges: Challenge[] }) {
  const [quest] = useState<Challenge[]>(() => dailyQuest(allChallenges, localDateKey(new Date())));

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line-strong bg-surface-raised px-6 py-6">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-micro tracking-widest text-accent uppercase">Today&rsquo;s quest</p>
        <p className="text-body text-ink-muted">
          {quest.length} challenges, the same ones everyone gets today &mdash; about 3-5 minutes.
        </p>
      </div>
      <ArenaPlayPanel challenges={quest} startLabel="Play today's quest" emptyLabel="Today's quest isn't ready yet." />
    </div>
  );
}
