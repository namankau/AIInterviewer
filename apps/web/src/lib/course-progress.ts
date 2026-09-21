/**
 * Counting course progress, and reading the progress this browser saved before progress
 * was account-backed.
 *
 * The store itself is now the API (`use-course-progress.ts`): progress kept in a browser
 * does not follow a candidate to a second device or a lab machine, and does not go away
 * when they sign out of a shared one. What remains here is the pure counting, which has
 * no idea where the data came from, plus the reader for the old `localStorage` key so a
 * candidate can import what they already ticked.
 *
 * "Complete" is something the learner says by pressing a button, never inferred from
 * having opened the page: opening a chapter is not the same as having learnt it.
 */

/** The key chapter completion used before it moved to the account. Read, never written. */
export const COURSE_PROGRESS_KEY = "course-progress:v1";

export type CompletedByCourse = Record<string, string[]>;

/** Anything that has ever been written under the key — including junk — becomes a valid map. */
export function parseProgress(raw: string | null | undefined): CompletedByCourse {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const obj = parsed as { version?: unknown; completed?: unknown };
    if (obj.version !== 1 || !obj.completed || typeof obj.completed !== "object") return {};

    const out: CompletedByCourse = {};
    for (const [course, slugs] of Object.entries(obj.completed as Record<string, unknown>)) {
      if (Array.isArray(slugs)) out[course] = slugs.filter((s): s is string => typeof s === "string");
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeProgress(completed: CompletedByCourse): string {
  return JSON.stringify({ version: 1, completed });
}

/** Returns a new map with the chapter's completion set to `done`; never mutates. */
export function withChapter(
  completed: CompletedByCourse,
  courseSlug: string,
  chapterSlug: string,
  done: boolean,
): CompletedByCourse {
  const current = new Set(completed[courseSlug] ?? []);
  if (done) current.add(chapterSlug);
  else current.delete(chapterSlug);
  return { ...completed, [courseSlug]: [...current] };
}

export interface CourseSummary<T extends { slug: string }> {
  done: number;
  total: number;
  /** Whole percent, 0-100. */
  percent: number;
  /** First chapter in reading order not yet complete, or undefined once everything is. */
  next: T | undefined;
  started: boolean;
  finished: boolean;
}

/**
 * Takes just the chapters (slug and whatever the caller wants back, such as a title), not a
 * whole `Course`: a client component that received a `Course` would ship every chapter's
 * full content to the browser to draw a progress bar.
 *
 * Counts only slugs that still exist: a chapter renamed or removed since it was ticked must
 * not push the total past 100% or make a finished course look unfinished.
 */
export function summarizeChapters<T extends { slug: string }>(
  chapters: readonly T[],
  completedSlugs: Iterable<string>,
): CourseSummary<T> {
  const done = new Set(completedSlugs);
  const doneCount = chapters.filter((chapter) => done.has(chapter.slug)).length;
  const total = chapters.length;

  return {
    done: doneCount,
    total,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    next: chapters.find((chapter) => !done.has(chapter.slug)),
    started: doneCount > 0,
    finished: total > 0 && doneCount === total,
  };
}
