"use client";

import { useState } from "react";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import { localDateKey, type DailyCourseQuest } from "@/lib/arena/progression";

/**
 * Today's three fixed, course-scoped sets, seeded from the calendar date (task 055, §2).
 * Which calendar date "today" is has to be read on the client (not the server component
 * around it), since it's the visitor's own local day, not the server's.
 *
 * The actual selection, though, still happens server-side (task 056, L3):
 * `questsByDate` is `dailyCourseQuests` already applied to every date that could be "today"
 * somewhere on Earth right now (`possibleDateKeysWorldwide`, at most three), computed by
 * the server component against the full corpus. This component just looks up its own
 * local date in that small map — the ~800-challenge corpus itself never crosses into the
 * client bundle or the RSC payload.
 */
export function ArenaDailyQuest({ questsByDate }: { questsByDate: Record<string, DailyCourseQuest[]> }) {
  const [quests] = useState<DailyCourseQuest[]>(() => questsByDate[localDateKey(new Date())] ?? []);

  return (
    <section aria-labelledby="daily-arena-heading" className="flex flex-col gap-6 rounded-2xl border border-accent/20 bg-accent-wash px-6 py-7 shadow-[var(--shadow-sm)] md:px-8">
      <div className="flex flex-col gap-1.5">
        <p className="w-fit rounded-full bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">Today&rsquo;s quest</p>
        <h2 id="daily-arena-heading" className="text-heading text-ink">A fresh set for every course</h2>
        <p className="max-w-2xl text-body text-ink-muted">
          Pick a course. Its three questions stay fixed for your local day, then rotate tomorrow.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {quests.map((quest, index) => {
          const topics = Array.from(new Set(quest.challenges.map((challenge) => challenge.moduleTitle)));
          return (
            <article
              key={quest.courseSlug}
              className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-col gap-2">
                <p className="font-mono text-micro tracking-widest text-accent-strong uppercase">
                  Daily set {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-heading text-ink">{quest.courseTitle}</h3>
                <p className="text-caption text-ink-muted">
                  {quest.challenges.length} questions · {topics.join(" · ")}
                </p>
              </div>
              <ArenaPlayPanel
                challenges={quest.challenges}
                courseSlug={quest.courseSlug}
                selectionMode="fixed"
                startLabel={`Play ${quest.courseTitle} set`}
                emptyLabel="Today's set isn't ready yet."
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
