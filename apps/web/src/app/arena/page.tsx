import type { Metadata } from "next";
import Link from "next/link";

import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { ProgressSummary } from "@/components/arena/progress-summary";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses } from "@/content/courses";
import { allArenaChallenges, challengesForCourse } from "@/lib/arena/corpus";

export const metadata: Metadata = {
  title: "Arena — AceMyInterview",
  description:
    "Short, sharp practice rounds derived from every Java and DSA chapter — spot the mistake, predict the " +
    "output, say what happens next. Free, and playable with no account.",
};

/**
 * The Arena landing page — public, free, server-rendered for search (task 055, §4). The
 * daily quest and the learner's own progress are the only parts that need the browser
 * (`localStorage`); everything else here, including every count, comes straight from the
 * real derived corpus.
 */
export default function ArenaPage() {
  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <Breadcrumbs items={[{ label: "home", href: "/dashboard" }, { label: "arena" }]} />
      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Free, always</p>
          <h1 className="text-display text-balance text-ink">Practice that feels like a game, taught from real chapters.</h1>
          <p className="max-w-xl text-body text-ink-muted">
            Every question here comes straight from a Java or DSA chapter that already exists — a mistake to
            spot, an output to predict, a diagram to read one step ahead. Answer, see why, and jump straight
            back to the chapter behind it.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1">
            <ArenaDailyQuest allChallenges={allArenaChallenges} />
          </div>
          <div className="lg:w-96 lg:shrink-0">
            <ProgressSummary />
          </div>
        </div>

        <section className="mt-14">
          <h2 className="text-title text-ink">Pick a course to practise</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2">
            {courses.map((course) => {
              const count = challengesForCourse(course.slug).length;
              return (
                <li key={course.slug}>
                  <Link
                    href={`/arena/${course.slug}`}
                    className="group flex h-full flex-col justify-between gap-6 rounded-md border border-line-strong bg-surface-raised px-6 py-6 transition-colors hover:border-accent"
                  >
                    <div className="flex flex-col gap-2.5">
                      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{course.level}</p>
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
      </main>
      <CourseSiteFooter />
    </div>
  );
}
