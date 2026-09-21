/**
 * Course chapter completion, owned by the account rather than the browser.
 *
 * Progress shipped first in `localStorage`, which meant it did not follow a candidate to
 * a second device or a lab machine, and did not go away when they signed out of a shared
 * one. These routes attach it to the signed-in candidate instead.
 */

/** `GET /api/v1/me/course-progress` — completed chapter slugs, keyed by course slug. */
export interface CourseProgressView {
  completed: Record<string, string[]>;
}

/** One chapter within one course. */
export interface ImportedChapter {
  courseSlug: string;
  chapterSlug: string;
}

/**
 * `POST /api/v1/me/course-progress/import` — a one-off import of progress that was saved
 * in this browser before progress was account-backed. A union: it never removes anything
 * the account already has.
 */
export interface ImportCourseProgressRequest {
  chapters: ImportedChapter[];
}
