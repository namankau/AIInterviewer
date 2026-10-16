"use client";

import { useState } from "react";

import { ArenaPlayPanel } from "@/components/arena/arena-play-panel";
import { ImportBrowserArenaProgress } from "@/components/arena/import-browser-arena";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { localDateKey, type DailyCourseQuest } from "@/lib/arena/progression";

/**
 * Today's fixed, course-scoped sets, seeded from the calendar date (task 055, §2).
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
  const [activeCourseSlug, setActiveCourseSlug] = useState<string | null>(null);
  const activeQuest = quests.find((quest) => quest.courseSlug === activeCourseSlug);

  return (
    <section
      aria-labelledby="daily-arena-heading"
      className="flex flex-col gap-6 rounded-surface border border-accent/20 bg-[linear-gradient(135deg,var(--surface-raised)_0%,var(--accent-wash)_100%)] px-5 py-6 shadow-[var(--shadow-md)] sm:px-6 sm:py-7 md:px-8"
    >
      {activeQuest ? (
        <DailyQuestWorkspace quest={activeQuest} onExit={() => setActiveCourseSlug(null)} />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="w-fit rounded-full bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">
              Today&rsquo;s quest
            </p>
            <h1 id="daily-arena-heading" className="text-heading text-ink">
              A fresh set for every course
            </h1>
            <p className="max-w-2xl text-body text-ink-muted">
              Pick a course. Its three questions stay fixed for your local day, then rotate
              tomorrow.
            </p>
          </div>
          <div className="grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {quests.map((quest) => {
              const topics = Array.from(
                new Set(quest.challenges.map((challenge) => challenge.moduleTitle)),
              );
              return (
                <article
                  key={quest.courseSlug}
                  className="card card-interactive group flex min-w-0 flex-col overflow-hidden"
                >
                  <CourseArtwork courseSlug={quest.courseSlug} />
                  <div className="flex grow flex-col p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="eyebrow text-accent">Today&apos;s set</p>
                      <span className="shrink-0 text-micro font-semibold text-ink-subtle">{quest.challenges.length} questions</span>
                    </div>
                    <h3 className="mt-3 text-heading font-bold text-ink transition-colors group-hover:text-accent">{quest.courseTitle}</h3>
                    <p className="mt-1.5 min-h-10 text-caption leading-relaxed text-ink-muted">{topics.join(" · ")}</p>
                    <button
                      type="button"
                      onClick={() => setActiveCourseSlug(quest.courseSlug)}
                      className="mt-auto flex w-full items-center justify-between gap-3 pt-5 text-left text-caption font-semibold text-accent focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <span>Play {quest.courseTitle} set</span><span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <ImportBrowserArenaProgress />
        </>
      )}
    </section>
  );
}

function DailyQuestWorkspace({
  onExit,
  quest,
}: {
  onExit: () => void;
  quest: DailyCourseQuest;
}) {
  const topics = Array.from(
    new Set(quest.challenges.map((challenge) => challenge.moduleTitle)),
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-accent/15 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-mono text-micro tracking-widest text-accent-strong uppercase">
            Today&rsquo;s quest · {quest.challenges.length} questions
          </p>
          <h1 id="daily-arena-heading" className="text-heading text-ink">
            {quest.courseTitle}
          </h1>
          <p className="text-caption leading-relaxed text-ink-muted">{topics.join(" · ")}</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 self-start rounded-lg border border-line bg-surface-raised px-4 py-2 text-caption font-medium text-ink transition-colors hover:border-accent/35 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Choose another set
        </button>
      </div>
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-line bg-surface-raised p-4 shadow-[var(--shadow-sm)] sm:p-6 lg:p-8">
        <ArenaPlayPanel
          key={quest.courseSlug}
          challenges={quest.challenges}
          courseSlug={quest.courseSlug}
          selectionMode="fixed"
          startLabel={`Play ${quest.courseTitle} set`}
          emptyLabel="Today's set isn't ready yet."
          initiallyPlaying
        />
      </div>
    </div>
  );
}
