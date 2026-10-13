"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import { localDateKey } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

export function DailyChallengeBanner({ questionsByDate, levelsByCourse }: { questionsByDate: Record<string, Challenge>; levelsByCourse: Record<string, string> }) {
  const [today] = useState(() => localDateKey(new Date()));
  const question = questionsByDate[today];
  if (!question) return null;
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(date);

  return (
    <section aria-label="Today's challenge" className="mt-7 flex flex-col gap-5 rounded-[1.35rem] border border-accent/20 bg-[linear-gradient(110deg,var(--accent-wash),var(--positive-wash))] px-5 py-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:gap-6 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
        <div className="grid size-16 shrink-0 content-center rounded-2xl bg-accent text-center text-accent-contrast shadow-[0_8px_22px_rgba(70,84,220,0.2)]">
          <span className="text-title font-extrabold leading-none">{day}</span>
          <span className="mt-1 text-micro font-bold uppercase tracking-widest">{monthLabel}</span>
        </div>
        <div className="min-w-0">
          <p className="eyebrow text-accent">Question of the day · {question.moduleTitle}</p>
          <h2 className="mt-1 line-clamp-1 text-heading font-bold text-ink">{question.chapterTitle ?? question.prompt}</h2>
          <p className="mt-1 line-clamp-1 text-caption text-ink-muted">{question.prompt}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
      {levelsByCourse[question.courseSlug] ? <span className="rounded-full bg-warning-wash px-3 py-1.5 text-micro font-semibold text-warning">{levelsByCourse[question.courseSlug]} path</span> : null}
      <Link href={"/daily-challenge" as Route} className="action-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start sm:self-auto">
        Solve today&apos;s question <span aria-hidden="true">→</span>
      </Link>
      </div>
    </section>
  );
}
