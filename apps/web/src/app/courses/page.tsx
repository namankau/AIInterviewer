import type { Metadata } from "next";
import Link from "next/link";

import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses, totalChapters, totalMinutes } from "@/content/courses";

export const metadata: Metadata = {
  title: "Courses — AceMyInterview",
  description:
    "Free courses that teach the fundamentals from the very start, chapter by chapter — Java " +
    "programming and data structures & algorithms, written so you never forget what you read.",
};

/**
 * The course catalogue. Public, no sign-in — organic search on a topic ("java arrays and
 * strings") is exactly the kind of query these pages exist to answer (PRD design brief,
 * 15 Sep 2026).
 */
export default function CoursesPage() {
  return (
    <div className="min-h-dvh">
      <CourseSiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Free, always</p>
          <h1 className="text-display text-balance text-ink">Learn it once, properly.</h1>
          <p className="max-w-xl text-body text-ink-muted">
            Every chapter is written to be taught once and never re-read: a real analogy, code you can run
            yourself, the mistakes people actually make, and a quiz that checks understanding rather than
            memory.
          </p>
        </header>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="group flex h-full flex-col justify-between gap-6 rounded-md border border-line-strong bg-surface-raised px-6 py-6 transition-colors hover:border-accent"
              >
                <div className="flex flex-col gap-2.5">
                  <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{course.level}</p>
                  <h2 className="text-title text-ink group-hover:text-accent">{course.title}</h2>
                  <p className="text-caption text-ink-muted">{course.tagline}</p>
                </div>
                <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                  {totalChapters(course)} chapters · {totalMinutes(course)} min
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-14 flex flex-col items-start gap-3 rounded-md border border-line-strong bg-surface-raised px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-micro tracking-widest text-accent uppercase">New</p>
            <p className="text-body text-ink">
              Rather test yourself than read? Try <span className="font-medium">the Arena</span> — short, gamified
              rounds derived straight from these chapters.
            </p>
          </div>
          <Link
            href="/arena"
            className="shrink-0 rounded-md bg-accent px-5 py-2.5 text-body font-medium text-white transition-colors hover:bg-accent-strong"
          >
            Play the Arena
          </Link>
        </div>
      </main>
      <CourseSiteFooter />
    </div>
  );
}
