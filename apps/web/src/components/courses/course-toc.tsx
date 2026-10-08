"use client";

import Link from "next/link";
import { useState } from "react";

import type { CourseTocData } from "@/lib/course-toc-data";
import { useCourseProgress } from "@/lib/use-course-progress";
import { CheckIcon } from "@/components/courses/course-progress";
import { InlineText } from "@/components/courses/inline-text";

/**
 * The reader's left sidebar: modules -> chapters, current chapter highlighted. Collapses
 * into a disclosure drawer on mobile so the reading column isn't squeezed on a phone.
 */
export function CourseToc({ course, currentSlug }: { course: CourseTocData; currentSlug: string }) {
  const [open, setOpen] = useState(false);
  const { completed, ready } = useCourseProgress(course.slug);
  const total = course.modules.reduce((count, module) => count + module.chapters.length, 0);
  const done = course.modules.reduce(
    (count, module) => count + module.chapters.filter((chapter) => completed.has(chapter.slug)).length,
    0,
  );
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <nav aria-label="Chapters" className="lg:sticky lg:top-24 lg:self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-caption font-semibold text-ink shadow-[var(--shadow-sm)] lg:hidden"
      >
        <span className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-accent-wash text-accent" aria-hidden="true">≡</span>
          Course chapters
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <div className={`${open ? "block" : "hidden"} overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] lg:block`}>
        <div className="border-b border-line bg-[linear-gradient(145deg,var(--navy),var(--navy-raised))] px-5 py-5 text-on-navy">
          <Link href={`/courses/${course.slug}`} className="group flex items-center gap-2 font-mono text-micro tracking-widest text-accent-on-navy uppercase hover:text-on-navy">
            <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">←</span>
            Course overview
          </Link>
          <p className="mt-3 text-heading font-semibold leading-snug text-on-navy">{course.title}</p>
          {ready ? (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <div className="h-full rounded-full bg-positive" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 font-mono text-micro text-on-navy-muted">{done} of {total} chapters complete</p>
            </div>
          ) : null}
        </div>
        <ol className="max-h-[calc(100dvh-16rem)] space-y-1 overflow-y-auto p-3">
          {course.modules.map((module, mi) => (
            <li key={module.title} className="border-b border-line pb-2 last:border-b-0 last:pb-0">
              <p className="px-2 pb-1 pt-2 font-mono text-micro font-semibold tracking-widest text-ink-subtle uppercase">
                {String(mi + 1).padStart(2, "0")} · {module.title}
              </p>
              <ol className="flex flex-col gap-0.5">
                {module.chapters.map((chapter) => {
                  const active = chapter.slug === currentSlug;
                  return (
                    <li key={chapter.slug}>
                      <Link
                        href={`/courses/${course.slug}/${chapter.slug}`}
                        aria-current={active ? "page" : undefined}
                        className={`group block rounded-lg px-2 py-2 text-caption transition-colors ${
                          active
                            ? "bg-accent-wash font-semibold text-accent-strong"
                            : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                        }`}
                      >
                        <span className="flex items-start gap-2.5">
                          <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${completed.has(chapter.slug) ? "border-positive bg-positive text-white" : active ? "border-accent bg-surface-raised" : "border-line-strong"}`}>
                          {completed.has(chapter.slug) ? (
                            <span>
                              <CheckIcon className="size-2.5" />
                              <span className="sr-only">Completed</span>
                            </span>
                          ) : null}
                          </span>
                          <span className="min-w-0 flex-1 leading-snug"><InlineText text={chapter.title} /></span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
