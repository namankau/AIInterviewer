import { courses, getChapter } from "@/content/courses";
import { openSourceArenaChallenges } from "@/content/arena/open-source-challenges";
import { deriveChallenges } from "@/lib/arena/derive";
import type { Challenge } from "@/lib/arena/types";

/**
 * The Arena's entire challenge corpus, derived once from the real course content this
 * module is imported (task 055). Every page and component that needs challenges imports
 * this rather than calling `deriveChallenges` again — same result either way, since it's
 * a pure function, but one call site keeps the derivation visible in one place.
 */
export const allArenaChallenges: Challenge[] = [...deriveChallenges(courses), ...openSourceArenaChallenges].map(
  (challenge) => ({
    ...challenge,
    chapterTitle: getChapter(challenge.courseSlug, challenge.chapterSlug)?.title,
  }),
);

/**
 * Standalone, course-authored multiple-choice checks for the dashboard. The complete
 * Arena intentionally includes code, diagrams and chapter-dependent mistake spotting;
 * those formats are excellent inside a course session but can feel arbitrary when one
 * appears alone on the dashboard. This bank keeps the large deterministic rotation while
 * only admitting questions that carry their own context and readable feedback.
 */
export const dashboardQuestionPool: Challenge[] = allArenaChallenges.filter(
  (challenge) =>
    challenge.kind === "mcq" &&
    challenge.prompt.trim().length >= 20 &&
    challenge.prompt.trim().length <= 280 &&
    challenge.options.length >= 3 &&
    challenge.options.length <= 5 &&
    challenge.options.every((option) => option.trim().length > 0 && option.trim().length <= 180) &&
    challenge.why.trim().length >= 10,
);

export function challengesForCourse(courseSlug: string): Challenge[] {
  return allArenaChallenges.filter((c) => c.courseSlug === courseSlug);
}

export function challengesForChapter(courseSlug: string, chapterSlug: string): Challenge[] {
  return allArenaChallenges.filter((c) => c.courseSlug === courseSlug && c.chapterSlug === chapterSlug);
}
