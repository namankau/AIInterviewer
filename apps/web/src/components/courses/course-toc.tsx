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
  const { completed } = useCourseProgress(course.slug);

  return (
    <nav aria-label="Chapters" className="md:sticky md:top-8 md:self-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between rounded-md border border-line px-4 py-2.5 text-caption font-medium text-ink md:hidden"
      >
        Chapters
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <div className={`${open ? "block" : "hidden"} md:block`}>
        <ol className="flex flex-col gap-5">
          {course.modules.map((module, mi) => (
            <li key={module.title}>
              <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                Module {mi + 1} — {module.title}
              </p>
              <ol className="mt-2 flex flex-col gap-0.5">
                {module.chapters.map((chapter) => {
                  const active = chapter.slug === currentSlug;
                  return (
                    <li key={chapter.slug}>
                      <Link
                        href={`/courses/${course.slug}/${chapter.slug}`}
                        aria-current={active ? "page" : undefined}
                        className={`-ml-px block border-l py-1 pl-3 text-caption transition-colors ${
                          active
                            ? "border-accent font-medium text-ink"
                            : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <InlineText text={chapter.title} />
                          {completed.has(chapter.slug) ? (
                            <span className="shrink-0 text-positive">
                              <CheckIcon className="size-3.5" />
                              <span className="sr-only">Completed</span>
                            </span>
                          ) : null}
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
