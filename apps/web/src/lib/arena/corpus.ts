import { courses } from "@/content/courses";
import { deriveChallenges } from "@/lib/arena/derive";
import type { Challenge } from "@/lib/arena/types";

/**
 * The Arena's entire challenge corpus, derived once from the real course content this
 * module is imported (task 055). Every page and component that needs challenges imports
 * this rather than calling `deriveChallenges` again — same result either way, since it's
 * a pure function, but one call site keeps the derivation visible in one place.
 */
export const allArenaChallenges: Challenge[] = deriveChallenges(courses);

export function challengesForCourse(courseSlug: string): Challenge[] {
  return allArenaChallenges.filter((c) => c.courseSlug === courseSlug);
}

export function challengesForChapter(courseSlug: string, chapterSlug: string): Challenge[] {
  return allArenaChallenges.filter((c) => c.courseSlug === courseSlug && c.chapterSlug === chapterSlug);
}
