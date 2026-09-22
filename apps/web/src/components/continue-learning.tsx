"use client";

import Link from "next/link";

import { InlineText } from "@/components/courses/inline-text";
import { ProgressBar } from "@/components/courses/course-progress";
import type { CourseOutline } from "@/lib/course-outline";
import { summarizeChapters } from "@/lib/course-progress";
import { useAllCourseProgress } from "@/lib/use-course-progress";

/**
 * "Pick up where you left off" on the dashboard.
 *
 * Shows the course with the most progress that is not yet finished, because that is
 * almost always the one somebody came back for. It renders nothing at all until progress
 * has loaded and at least one course has been started: an empty "continue" card on a
 * dashboard whose single job is starting an interview would be clutter, and the dashboard
 * already has one primary action that nothing else may compete with.
 *
 * Takes `outlines` as a prop rather than importing course content itself (task 056, L2):
 * this is a client component, and the full course registry carries every chapter's code
 * samples, `viz` frames and quizzes — 744 KB of it. The caller derives the slim outline
 * (`getCourseOutlines`, server-side only) and hands down just the slugs and titles this
 * needs.
 */
export function ContinueLearning({ outlines }: { outlines: CourseOutline[] }) {
  const { completed, status } = useAllCourseProgress();

  if (status !== "ready") return null;

  const candidates = outlines
    .map((course) => {
      const chapters = course.chapters;
      return { course, summary: summarizeChapters(chapters, completed[course.slug] ?? []) };
    })
    .filter((entry) => entry.summary.started && !entry.summary.finished && entry.summary.next);

  if (candidates.length === 0) return null;

  // Most progressed first, so returning to a nearly-finished course beats one barely begun.
  const { course, summary } = candidates.sort((a, b) => b.summary.percent - a.summary.percent)[0]!;
  const next = summary.next!;

  return (
    <section className="rounded-lg border border-line bg-surface-raised px-6 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Continue learning</p>
          <p className="text-heading text-ink">{course.title}</p>
          <p className="text-caption text-ink-muted">
            Up next: <InlineText text={next.title} />
          </p>
        </div>
        <Link
          href={`/courses/${course.slug}/${next.slug}`}
          className="shrink-0 rounded-lg border border-line-strong px-4 py-2.5 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          Resume
        </Link>
      </div>
      <div className="mt-4 max-w-sm">
        <ProgressBar done={summary.done} total={summary.total} label={`${course.title} progress`} />
      </div>
    </section>
  );
}
