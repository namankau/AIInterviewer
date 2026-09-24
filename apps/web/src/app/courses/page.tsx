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
    "programming, data structures & algorithms, and AI and agentic AI, written so you never forget " +
    "what you read.",
};

/** The signed-in learning catalogue, presented inside the same workspace as the Arena and rounds. */
export default function CoursesPage() {
  return (
    <AppShell breadcrumb="courses">
      <ImportBrowserProgress />
      <header className="relative overflow-hidden rounded-3xl border border-accent/20 bg-[linear-gradient(135deg,var(--navy)_0%,var(--navy-raised)_65%,var(--accent-strong)_140%)] px-7 py-10 text-on-navy shadow-[var(--shadow-md)] md:px-10 md:py-12">
        <div aria-hidden="true" className="absolute -right-16 -top-20 size-64 rounded-full border-[32px] border-white/5" />
        <div className="relative max-w-3xl">
          <p className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-micro tracking-widest text-accent-on-navy uppercase">
            Guided learning paths
          </p>
          <h1 className="mt-5 text-display text-balance text-on-navy">Learn the skill. Practise the pattern.</h1>
          <p className="mt-4 max-w-2xl text-body leading-relaxed text-on-navy-muted">
            Short, structured chapters pair plain-language explanations with runnable code, visual examples
            and quick checks—so study feels active rather than endless.
          </p>
        </div>
      </header>

      <section aria-labelledby="learning-paths" className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-micro tracking-widest text-accent uppercase">Choose your focus</p>
            <h2 id="learning-paths" className="mt-2 text-heading text-ink">Three paths, one interview toolkit</h2>
          </div>
          <p className="text-caption text-ink-muted">Continue from exactly where you stopped.</p>
        </div>
        <ul className="grid gap-5 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.slug} className="min-w-0">
              <Link
                href={`/courses/${course.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-accent/35 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-accent/20 bg-accent-wash px-6 py-6 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-micro tracking-widest text-accent uppercase">Daily practice</p>
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
    </AppShell>
  );
}
