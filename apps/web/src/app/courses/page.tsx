import type { Metadata } from "next";
import Link from "next/link";

import { CourseCardProgress } from "@/components/courses/course-progress";
import { ImportBrowserProgress } from "@/components/courses/import-browser-progress";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { courses, totalChapters, totalMinutes } from "@/content/courses";

export const metadata: Metadata = {
  title: "Courses — AceMyInterview",
  description:
    "Free courses that teach the fundamentals from the very start, chapter by chapter — Java " +
    "programming, data structures & algorithms, and AI and agentic AI, written so you never forget " +
    "what you read.",
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
      <Breadcrumbs items={[{ label: "home", href: "/dashboard" }, { label: "courses" }]} />
      <ImportBrowserProgress />
      <main>
        <header className="border-b border-line bg-accent-wash/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-14 md:py-20">
            <p className="w-fit rounded-full border border-accent/20 bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">
              Free, always
            </p>
            <h1 className="max-w-3xl text-display text-balance text-ink">Learn it once, properly.</h1>
            <p className="max-w-2xl text-body leading-relaxed text-ink-muted">
              Every chapter is written to be taught once and never re-read: a real analogy, code you can run
              yourself, the mistakes people actually make, and a quiz that checks understanding rather than
              memory.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="group flex h-full flex-col justify-between gap-8 rounded-2xl border border-line bg-surface-raised px-6 py-7 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex flex-col gap-2.5">
                  <p className="w-fit rounded-full bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">{course.level}</p>
                  <h2 className="text-title text-ink group-hover:text-accent">{course.title}</h2>
                  <p className="text-caption leading-relaxed text-ink-muted">{course.tagline}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <CourseCardProgress
                    courseSlug={course.slug}
                    chapters={course.modules.flatMap((m) => m.chapters.map((c) => ({ slug: c.slug, title: c.title })))}
                  />
                  <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                    {totalChapters(course)} chapters · {totalMinutes(course)} min
                  </p>
                </div>
              </Link>
            </li>
          ))}
          </ul>

          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-accent/20 bg-accent-wash px-6 py-6 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-micro tracking-widest text-accent uppercase">New</p>
            <p className="text-body text-ink">
              Rather test yourself than read? Try <span className="font-medium">the Arena</span> — short, gamified
              rounds derived straight from these chapters.
            </p>
          </div>
          <Link
            href="/arena"
            className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast shadow-[var(--shadow-sm)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-accent-strong"
          >
            Play the Arena
          </Link>
          </div>
        </div>
      </main>
      <CourseSiteFooter />
    </div>
  );
}
