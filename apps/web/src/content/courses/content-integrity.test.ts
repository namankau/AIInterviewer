import { describe, expect, it } from "vitest";

import { courses, flattenChapters, getAdjacentChapters } from "@/content/courses";
import type { Block, Chapter, Course } from "@/content/courses/types";

/**
 * Every registered chapter, of every course, is held to the same bar (task 045): the
 * writing standard says what a chapter must contain, and this test is what actually
 * enforces it, rather than trusting each chapter file to remember on its own.
 */

function blocksOf(kind: Block["kind"], chapter: Chapter): Block[] {
  return chapter.blocks.filter((b) => b.kind === kind);
}

describe("course registry", () => {
  it("has at least one course, and every course has at least one chapter", () => {
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      expect(flattenChapters(course).length).toBeGreaterThan(0);
    }
  });

  it("has unique course slugs", () => {
    const slugs = courses.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe.each(courses)("course: $slug", (course: Course) => {
  const chapters = flattenChapters(course);

  it("has unique chapter slugs", () => {
    const slugs = chapters.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("orders prev/next across module boundaries correctly", () => {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      if (!chapter) continue;
      const { prev, next } = getAdjacentChapters(course, chapter.slug);
      expect(prev?.slug).toBe(i === 0 ? undefined : chapters[i - 1]?.slug);
      expect(next?.slug).toBe(i === chapters.length - 1 ? undefined : chapters[i + 1]?.slug);
    }
  });

  describe.each(chapters)("chapter: $slug", (chapter: Chapter) => {
    it("has a non-empty summary, title and a positive reading time", () => {
      expect(chapter.summary.trim().length).toBeGreaterThan(0);
      expect(chapter.title.trim().length).toBeGreaterThan(0);
      expect(chapter.minutes).toBeGreaterThan(0);
    });

    it("has at least one analogy block", () => {
      expect(blocksOf("analogy", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one code block with real, non-empty code", () => {
      const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
      for (const block of codeBlocks) {
        expect(block.code.trim().length).toBeGreaterThan(0);
      }
    });

    it("has exactly one remember box", () => {
      expect(blocksOf("remember", chapter).length).toBe(1);
    });

    it("has at least one interview-angle box", () => {
      expect(blocksOf("interview", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has at least one pitfall box", () => {
      expect(blocksOf("pitfall", chapter).length).toBeGreaterThanOrEqual(1);
    });

    it("has 2-3 quiz questions, each with an answer index in range and a non-empty why", () => {
      const quizzes = blocksOf("quiz", chapter) as Extract<Block, { kind: "quiz" }>[];
      expect(quizzes.length).toBeGreaterThanOrEqual(2);
      expect(quizzes.length).toBeLessThanOrEqual(3);
      for (const quiz of quizzes) {
        expect(quiz.answer).toBeGreaterThanOrEqual(0);
        expect(quiz.answer).toBeLessThan(quiz.options.length);
        expect(quiz.why.trim().length).toBeGreaterThan(0);
        expect(quiz.options.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("every remember/pitfall/interview box has at least one non-empty item", () => {
      const boxes = [...blocksOf("remember", chapter), ...blocksOf("pitfall", chapter), ...blocksOf("interview", chapter)] as Extract<
        Block,
        { kind: "remember" | "pitfall" | "interview" }
      >[];
      for (const box of boxes) {
        expect(box.items.length).toBeGreaterThan(0);
        for (const item of box.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });
});
