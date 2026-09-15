import { chapterWhatIsJava } from "@/content/courses/java/01-what-is-java";
import { chapterFirstProgram } from "@/content/courses/java/02-first-program";
import { chapterVariablesAndTypes } from "@/content/courses/java/03-variables-and-types";
import { chapterOperators } from "@/content/courses/java/04-operators";
import { chapterInputOutput } from "@/content/courses/java/05-input-output";
import { chapterTypeCasting } from "@/content/courses/java/06-type-casting";
import { chapterIfElseSwitch } from "@/content/courses/java/07-if-else-switch";
import { chapterLoops } from "@/content/courses/java/08-loops";
import { chapterBreakContinueNested } from "@/content/courses/java/09-break-continue-nested";
import { chapterArrays } from "@/content/courses/java/10-arrays";
import { chapterStrings } from "@/content/courses/java/11-strings";
import { chapterStringBuilder } from "@/content/courses/java/12-stringbuilder";
import { chapterMethods } from "@/content/courses/java/13-methods";
import { chapterRecursion } from "@/content/courses/java/14-recursion-basics";
import type { Course } from "@/content/courses/types";

/**
 * Java programming (PRD design brief, 15 Sep 2026). Modules 1-3 are written (task 045);
 * modules 4-6 — OOP, core APIs, beyond basics — are task 045b.
 */
export const javaCourse: Course = {
  slug: "java",
  title: "Java Programming",
  tagline: "From your first line of code to the interview round that asks about it.",
  level: "Beginner — no prior programming experience assumed",
  modules: [
    {
      title: "Getting started",
      chapters: [
        chapterWhatIsJava,
        chapterFirstProgram,
        chapterVariablesAndTypes,
        chapterOperators,
        chapterInputOutput,
        chapterTypeCasting,
      ],
    },
    {
      title: "Control flow",
      chapters: [chapterIfElseSwitch, chapterLoops, chapterBreakContinueNested],
    },
    {
      title: "Arrays, strings, methods",
      chapters: [chapterArrays, chapterStrings, chapterStringBuilder, chapterMethods, chapterRecursion],
    },
  ],
};
