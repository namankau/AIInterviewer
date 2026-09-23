import type { Course } from "@/content/courses/types";

export interface CourseTocChapter {
  slug: string;
  title: string;
}

export interface CourseTocModule {
  title: string;
  chapters: CourseTocChapter[];
}

/**
 * The chapter rail is interactive, so its props cross the server/client boundary. Keep
 * that payload to navigation metadata instead of serialising every code sample, quiz and
 * visual frame in the course merely to draw links (task 059).
 */
export interface CourseTocData {
  slug: string;
  modules: CourseTocModule[];
}

export function toCourseTocData(course: Course): CourseTocData {
  return {
    slug: course.slug,
    modules: course.modules.map((module) => ({
      title: module.title,
      chapters: module.chapters.map((chapter) => ({
        slug: chapter.slug,
        title: chapter.title,
      })),
    })),
  };
}

