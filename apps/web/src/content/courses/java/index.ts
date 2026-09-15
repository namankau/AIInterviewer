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
import { chapterClassesAndObjects } from "@/content/courses/java/15-classes-and-objects";
import { chapterConstructorsAndThis } from "@/content/courses/java/16-constructors-and-this";
import { chapterStatic } from "@/content/courses/java/17-static";
import { chapterEncapsulation } from "@/content/courses/java/18-encapsulation-access-modifiers";
import { chapterInheritance } from "@/content/courses/java/19-inheritance-and-super";
import { chapterPolymorphism } from "@/content/courses/java/20-polymorphism";
import { chapterAbstractInterfaces } from "@/content/courses/java/21-abstract-classes-and-interfaces";
import { chapterPackages } from "@/content/courses/java/22-packages";
import { chapterExceptions } from "@/content/courses/java/23-exceptions";
import { chapterWrapperClasses } from "@/content/courses/java/24-wrapper-classes-autoboxing";
import { chapterCollectionsOverview } from "@/content/courses/java/25-collections-overview";
import { chapterArrayListVsLinkedList } from "@/content/courses/java/26-arraylist-vs-linkedlist";
import { chapterHashMapHashSet } from "@/content/courses/java/27-hashmap-and-hashset";
import { chapterGenerics } from "@/content/courses/java/28-generics";
import { chapterComparableComparator } from "@/content/courses/java/29-comparable-and-comparator";
import type { Course } from "@/content/courses/types";

/**
 * Java programming (PRD design brief, 15 Sep 2026). Modules 1-3 are task 045;
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
    {
      title: "OOP",
      chapters: [
        chapterClassesAndObjects,
        chapterConstructorsAndThis,
        chapterStatic,
        chapterEncapsulation,
        chapterInheritance,
        chapterPolymorphism,
        chapterAbstractInterfaces,
        chapterPackages,
      ],
    },
    {
      title: "Core APIs",
      chapters: [
        chapterExceptions,
        chapterWrapperClasses,
        chapterCollectionsOverview,
        chapterArrayListVsLinkedList,
        chapterHashMapHashSet,
        chapterGenerics,
        chapterComparableComparator,
      ],
    },
  ],
};
