import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CourseCardProgress } from "@/components/courses/course-progress";
import { ImportBrowserProgress } from "@/components/courses/import-browser-progress";
import { CourseAccentLine, CourseMotif, getCoursePresentation } from "@/components/courses/course-visuals";
import { courses, totalChapters, totalMinutes } from "@/content/courses";

export const metadata: Metadata = {
  title: "Courses — AceMyInterview",
  description:
    "Free courses that teach the fundamentals from the very start, chapter by chapter — Java " +
    "programming, data structures & algorithms, AI and agentic AI, and system design with interactive " +
    "architecture practice.",
};

/** The signed-in learning catalogue, presented inside the same workspace as the Arena and rounds. */
export default function CoursesPage() {
  const lessonCount = courses.reduce((total, course) => total + totalChapters(course), 0);

  return (
    <AppShell breadcrumb="courses">
      <ImportBrowserProgress />
      <header className="hero-band relative overflow-hidden px-7 py-10 md:px-10 md:py-12">
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
          <div className="max-w-3xl">
            <p className="eyebrow text-accent-on-navy">Learn by doing</p>
            <h1 className="mt-4 text-display text-balance text-on-navy">Build skills that stick.</h1>
            <p className="mt-3 max-w-2xl text-body leading-relaxed text-on-navy-muted">
              Short, interactive chapters with runnable examples, visual explanations and quick checks.
              No passive video queue.
            </p>
          </div>
          <div className="border-white/15 lg:border-l lg:pl-10">
            <p className="text-display text-on-navy">{lessonCount}</p>
            <p className="mt-1 text-caption text-on-navy-muted">free interactive chapters</p>
          </div>
        </div>
      </header>

      <section className="mt-7 flex flex-col gap-5 rounded-2xl border border-accent/20 bg-[linear-gradient(100deg,var(--accent-wash),var(--positive-wash))] p-6 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-accent">Daily practice</p>
          <h2 className="mt-2 text-heading text-ink">Turn today&apos;s chapter into a short recall round.</h2>
          <p className="mt-1 text-caption text-ink-muted">The Arena pulls its challenges directly from these learning paths.</p>
        </div>
        <Link href="/arena" className="action-primary shrink-0">Open today&apos;s challenge <span aria-hidden>→</span></Link>
      </section>

      <section aria-labelledby="learning-paths" className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-micro tracking-widest text-accent uppercase">Choose your focus</p>
            <h2 id="learning-paths" className="mt-2 text-heading text-ink">Four paths, one interview toolkit</h2>
          </div>
          <p className="text-caption text-ink-muted">Continue from exactly where you stopped.</p>
        </div>
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.slug} className="min-w-0">
              <Link
                href={`/courses/${course.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/35 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CourseAccentLine courseSlug={course.slug} />
                    <p className="mt-4 font-mono text-micro tracking-widest text-ink-subtle uppercase">
                      {getCoursePresentation(course.slug).shortLabel} learning path
                    </p>
                  </div>
                  <CourseMotif courseSlug={course.slug} />
                </div>
                <h3 className="mt-5 text-title text-ink transition-colors group-hover:text-accent">{course.title}</h3>
                <p className="mt-2 min-h-12 text-caption leading-relaxed text-ink-muted">{course.tagline}</p>

                <dl className="mt-6 space-y-3 border-y border-line py-5 text-caption">
                  <div>
                    <dt className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Outcome</dt>
                    <dd className="mt-1 font-medium leading-snug text-ink">{getCoursePresentation(course.slug).outcome}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Hands-on practice</dt>
                    <dd className="mt-1 text-ink-muted">{getCoursePresentation(course.slug).practice}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-col gap-3 pt-5">
                  <CourseCardProgress
                    courseSlug={course.slug}
                    chapters={course.modules.flatMap((m) => m.chapters.map((c) => ({ slug: c.slug, title: c.title })))}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                      {course.modules.length} modules · {totalChapters(course)} chapters · {totalMinutes(course)} min
                    </p>
                    <span aria-hidden="true" className="text-heading text-accent transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

    </AppShell>
  );
}
