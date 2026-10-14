import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportBrowserArenaProgress } from "@/components/arena/import-browser-arena";
import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { ProgressSummary } from "@/components/arena/progress-summary";
import { AppShell } from "@/components/app-shell";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { courses } from "@/content/courses";
import { allArenaChallenges, challengesForCourse } from "@/lib/arena/corpus";
import { dailyCourseQuests, possibleDateKeysWorldwide } from "@/lib/arena/progression";
import { courseEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = {
  title: "Arena — Untiered",
  description:
    "Short, sharp practice rounds derived from every chapter of every course — spot the mistake, predict " +
    "the output, say what happens next. Included free in the signed-in learning workspace.",
};

/**
 * The signed-in Arena landing page. Daily sets are selected server-side from the real
 * corpus; account progress is the only part that needs the browser.
 */
export default function ArenaPage() {
  requireFeature("arena");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));
  if (visibleCourses.length === 0) notFound();
  const courseNames = new Intl.ListFormat("en", { type: "disjunction" }).format(
    visibleCourses.map((course) => course.title),
  );
  // Computed here, against the full corpus, server-side — only the resulting handful of
  // challenges (at most 3 dates * number of courses * 3 questions) crosses into the client (task 056, L3).
  const questsByDate = Object.fromEntries(
    possibleDateKeysWorldwide().map((dateKey) => [
      dateKey,
      dailyCourseQuests(
        allArenaChallenges,
        visibleCourses.map(({ slug, title }) => ({ slug, title })),
        dateKey,
      ),
    ]),
  );

  return (
    <AppShell breadcrumb="arena">
      <div className="flex flex-col gap-10">
        <header className="hero-band relative overflow-hidden px-7 py-10 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -top-28 right-0 size-80 rounded-full bg-accent/25 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-36 left-1/3 size-72 rounded-full bg-positive/15 blur-3xl" />
          <div className="relative flex flex-col gap-5">
            <p className="pill pill-navy w-fit">Daily practice · {visibleCourses.length} courses</p>
            <h1 className="max-w-4xl text-display text-balance text-on-navy">
              A few sharp questions. A different set tomorrow.
            </h1>
            <p className="max-w-2xl text-body leading-relaxed text-on-navy-muted">
              Choose {courseNames}. Each course gets its own daily set, labelled by topic, with an
              explanation after every answer and a link back to the chapter when something does not click.
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
              {visibleCourses.map((course) => {
                const count = challengesForCourse(course.slug).length;
                return (
                  <li key={course.slug}>
                    <Link
                      href={`/arena/${course.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-surface-raised shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <CourseArtwork courseSlug={course.slug} />
                      <div className="flex grow flex-col p-5">
                        <p className="eyebrow text-accent">Practice path <span className="ml-2 font-sans normal-case tracking-normal text-ink-subtle">· {course.level}</span></p>
                        <h3 className="mt-3 text-heading font-bold text-ink group-hover:text-accent">{course.title}</h3>
                        <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">{course.tagline}</p>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-5 text-caption">
                          <span className="text-ink-muted">{count} questions · {course.modules.length} modules</span>
                          <span className="shrink-0 font-semibold text-accent">Explore <span aria-hidden="true">→</span></span>
                        </div>
                      </div>
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
