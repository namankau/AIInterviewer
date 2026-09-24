import type { Metadata } from "next";
import Link from "next/link";

import { ImportBrowserArenaProgress } from "@/components/arena/import-browser-arena";
import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { ProgressSummary } from "@/components/arena/progress-summary";
import { AppShell } from "@/components/app-shell";
import { courses } from "@/content/courses";
import { allArenaChallenges, challengesForCourse } from "@/lib/arena/corpus";
import { dailyCourseQuests, possibleDateKeysWorldwide } from "@/lib/arena/progression";

export const metadata: Metadata = {
  title: "Arena — AceMyInterview",
  description:
    "Short, sharp practice rounds derived from every chapter of every course — spot the mistake, predict " +
    "the output, say what happens next. Included free in the signed-in learning workspace.",
};

/**
 * The signed-in Arena landing page. Daily sets are selected server-side from the real
 * corpus; account progress is the only part that needs the browser.
 */
export default function ArenaPage() {
  // Computed here, against the full corpus, server-side — only the resulting handful of
  // challenges (at most 3 dates * number of courses * 3 questions) crosses into the client (task 056, L3).
  const questsByDate = Object.fromEntries(
    possibleDateKeysWorldwide().map((dateKey) => [
      dateKey,
      dailyCourseQuests(
        allArenaChallenges,
        courses.map(({ slug, title }) => ({ slug, title })),
        dateKey,
      ),
    ]),
  );

  return (
    <AppShell breadcrumb="arena">
      <div className="flex flex-col gap-10">
        <header className="relative overflow-hidden rounded-[1.75rem] bg-navy px-7 py-10 text-on-navy shadow-[var(--shadow-md)] sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -top-32 right-0 size-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative flex flex-col gap-5">
            <p className="w-fit rounded-full border border-accent/20 bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">
              Daily practice · all four courses
            </p>
            <h1 className="max-w-4xl text-display text-balance text-on-navy">
              A few sharp questions. A different set tomorrow.
            </h1>
            <p className="max-w-2xl text-body leading-relaxed text-on-navy-muted">
              Choose Java, DSA, AI or System Design. Each course gets its own topic-labelled daily set, with
              explanations and a direct route back to the chapter when something does not click.
            </p>
          </div>
        </header>

        <ArenaDailyQuest questsByDate={questsByDate} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section>
            <h2 className="text-title text-ink">Keep practising by course</h2>
            <p className="mt-2 max-w-2xl text-caption text-ink-muted">
              These sessions use your review history to bring back due questions and mix in unseen topics.
            </p>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {courses.map((course) => {
                const count = challengesForCourse(course.slug).length;
                return (
                  <li key={course.slug}>
                    <Link
                      href={`/arena/${course.slug}`}
                      className="group flex h-full flex-col justify-between gap-7 rounded-2xl border border-line bg-surface-raised px-6 py-7 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
                    >
                      <div className="flex flex-col gap-2.5">
                        <p className="w-fit rounded-full bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">{course.level}</p>
                        <h3 className="text-title text-ink group-hover:text-accent">{course.title}</h3>
                        <p className="text-caption text-ink-muted">{course.tagline}</p>
                      </div>
                      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                        {count} challenges · {course.modules.length} campaigns
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="flex flex-col gap-4">
            <ProgressSummary />
            <ImportBrowserArenaProgress />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
