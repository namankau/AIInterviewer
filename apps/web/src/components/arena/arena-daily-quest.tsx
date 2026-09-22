"use client";

import { useState } from "react";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import { localDateKey } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

/**
 * Today's fixed set — the same 7 challenges for every visitor today, seeded from the
 * calendar date (task 055, §2). Which calendar date "today" is has to be read on the
 * client (not the server component around it), since it's the visitor's own local day, not
 * the server's.
 *
 * The actual selection, though, still happens server-side (task 056, L3):
 * `questsByDate` is `dailyQuest` already applied to every date that could be "today"
 * somewhere on Earth right now (`possibleDateKeysWorldwide`, at most three), computed by
 * the server component against the full corpus. This component just looks up its own
 * local date in that small map — the ~800-challenge corpus itself never crosses into the
 * client bundle or the RSC payload.
 */
export function ArenaDailyQuest({ questsByDate }: { questsByDate: Record<string, Challenge[]> }) {
  const [quest] = useState<Challenge[]>(() => questsByDate[localDateKey(new Date())] ?? []);

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
