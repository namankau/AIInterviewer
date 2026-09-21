"use client";

import Link from "next/link";

import { InlineText } from "@/components/courses/inline-text";
import { summarizeChapters } from "@/lib/course-progress";
import { useCourseProgress } from "@/lib/use-course-progress";

/** The chapter data the client needs — slugs and titles only, never chapter content. */
export interface ChapterRef {
  slug: string;
  title: string;
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A labelled bar. The numbers are the meaning; the fill is only a scan aid. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} chapters complete`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-positive transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
        {done} of {total} chapters · {percent}%
      </p>
    </div>
  );
}

/** Course-page hero: how far along, and one button that goes to the right place. */
export function CourseHeroProgress({
  courseSlug,
  chapters,
}: {
  courseSlug: string;
  chapters: ChapterRef[];
}) {
  const { completed } = useCourseProgress(courseSlug);
  const summary = summarizeChapters(chapters, completed);
  const first = chapters[0];
  const target = summary.next ?? first;

  return (
    <div className="flex max-w-md flex-col gap-4">
      {summary.started ? <ProgressBar done={summary.done} total={summary.total} label="Course progress" /> : null}
      {target ? (
        <Link
          href={`/courses/${courseSlug}/${target.slug}`}
          className="w-fit rounded-md bg-accent px-5 py-2.5 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          {summary.finished ? "Review from the start" : summary.started ? "Continue learning" : "Start course"}
        </Link>
      ) : null}
      {summary.started && !summary.finished && summary.next ? (
        <p className="text-caption text-ink-muted">Up next: <InlineText text={summary.next.title} /></p>
      ) : null}
      {summary.finished ? <p className="text-caption font-medium text-positive">Every chapter complete.</p> : null}
    </div>
  );
}

/** A catalogue card's progress line; renders nothing until the learner has started. */
export function CourseCardProgress({ courseSlug, chapters }: { courseSlug: string; chapters: ChapterRef[] }) {
  const { completed } = useCourseProgress(courseSlug);
  const summary = summarizeChapters(chapters, completed);
  if (!summary.started) return null;
  return <ProgressBar done={summary.done} total={summary.total} label="Course progress" />;
}

/** "2 of 5 done" for a module heading. Empty until something in it is complete. */
export function ModuleProgress({ courseSlug, chapterSlugs }: { courseSlug: string; chapterSlugs: string[] }) {
  const { completed } = useCourseProgress(courseSlug);
  const done = chapterSlugs.filter((slug) => completed.has(slug)).length;
  if (done === 0) return null;
  return (
    <span className="font-mono text-micro tracking-widest text-positive uppercase">
      {done === chapterSlugs.length ? "Complete" : `${done} of ${chapterSlugs.length} done`}
    </span>
  );
}

/** The tick in a chapter row: a check plus a visually hidden word, so it is not colour alone. */
export function ChapterDoneMark({ courseSlug, chapterSlug }: { courseSlug: string; chapterSlug: string }) {
  const { completed } = useCourseProgress(courseSlug);
  const done = completed.has(chapterSlug);
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
        done ? "border-positive bg-positive text-white" : "border-line-strong text-transparent"
      }`}
    >
      {done ? <CheckIcon className="size-3" /> : null}
      <span className="sr-only">{done ? "Completed" : "Not completed"}</span>
    </span>
  );
}

/** End-of-chapter control. Completion is the learner's statement, never inferred from a visit. */
export function MarkCompleteButton({ courseSlug, chapterSlug }: { courseSlug: string; chapterSlug: string }) {
  const { completed, setChapterDone } = useCourseProgress(courseSlug);
  const done = completed.has(chapterSlug);

  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => setChapterDone(chapterSlug, !done)}
      className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-caption font-medium transition-colors ${
        done
          ? "border-positive/50 bg-positive/10 text-ink hover:bg-positive/15"
          : "border-accent bg-accent text-accent-contrast hover:bg-accent-strong"
      }`}
    >
      {done ? <CheckIcon className="text-positive" /> : null}
      {done ? "Completed — click to undo" : "Mark chapter as complete"}
    </button>
  );
}
