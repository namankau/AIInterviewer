import { chapterComplexity } from "@/content/courses/dsa/02-complexity";
import { chapterInterviewApproach } from "@/content/courses/dsa/03-interview-approach";
import { chapterWhatIsDsa } from "@/content/courses/dsa/01-what-is-dsa";
import { chapterArraysInMemory } from "@/content/courses/dsa/04-arrays-in-memory";
import { chapterTwoPointers } from "@/content/courses/dsa/05-two-pointers";
import { chapterSlidingWindow } from "@/content/courses/dsa/06-sliding-window";
import { chapterPrefixSums } from "@/content/courses/dsa/07-prefix-sums";
import { chapterStringTechniques } from "@/content/courses/dsa/08-string-techniques";
import type { Course } from "@/content/courses/types";

/**
 * Data Structures & Algorithms (task 046). Modules 1-4 — foundations; arrays and strings; hashing and
 * recursion; sorting and searching — are written here; modules 5-8 are task 046b (feat/courses-dsa-2).
 */
export const dsaCourse: Course = {
  slug: "dsa",
  title: "Data Structures & Algorithms",
  tagline: "The patterns behind every coding round, explained once so you actually keep them.",
  level: "Beginner — assumes the Java Programming course, or equivalent basics",
  modules: [
    {
      title: "Foundations",
      chapters: [chapterWhatIsDsa, chapterComplexity, chapterInterviewApproach],
    },
    {
      title: "Arrays and strings",
      chapters: [
        chapterArraysInMemory,
        chapterTwoPointers,
        chapterSlidingWindow,
        chapterPrefixSums,
        chapterStringTechniques,
      ],
    },
  ],
};
