import { courses } from "@/content/courses";

/**
 * The slim shape of a course a client component is allowed to see (task 056, L2): a slug
 * and a title, per course and per chapter. Nothing else — no `blocks`, so no code samples,
 * `viz` frames or quizzes ever cross into client-bundled data derived from this module.
 */
export interface CourseOutlineChapter {
  slug: string;
  title: string;
}

export interface CourseOutline {
  slug: string;
  title: string;
  chapters: CourseOutlineChapter[];
}

/**
 * Derived from `courses` every call, not hand-maintained — adding a course to the registry
 * is enough for it to show up here too, so this can never silently drift from the real
 * course list the way a second hand-kept array could.
 *
 * Only ever call this from a server context (a Server Component, a route handler). It
 * imports the full course content barrel to derive the outline, so a client component that
 * imports this module would pull the same 744 KB of chapter bodies back in through the side
 * door — pass its *return value* down as props instead.
 */
export function getCourseOutlines(): CourseOutline[] {
  return courses.map((course) => ({
    slug: course.slug,
    title: course.title,
    chapters: course.modules.flatMap((module) =>
      module.chapters.map((chapter) => ({ slug: chapter.slug, title: chapter.title })),
    ),
  }));
}
