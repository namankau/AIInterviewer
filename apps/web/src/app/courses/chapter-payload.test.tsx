import type { ReactNode } from "react";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChapterPage from "@/app/courses/[course]/[chapter]/page";
import type { Block } from "@/content/courses/types";
import type { CourseTocData } from "@/lib/course-toc-data";

const captured = vi.hoisted(() => ({
  toc: [] as CourseTocData[],
  lessons: [] as Block[][],
}));

vi.mock("@/components/courses/course-toc", () => ({
  CourseToc: ({ course }: { course: CourseTocData }) => {
    captured.toc.push(course);
    return null;
  },
}));
vi.mock("@/components/courses/guided-lesson", () => ({
  GuidedLesson: ({ blocks }: { blocks: Block[] }) => {
    captured.lessons.push(blocks);
    return null;
  },
}));
vi.mock("@/components/courses/code-language-context", () => ({
  CodeLanguageProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/courses/course-progress", () => ({ MarkCompleteButton: () => null }));
vi.mock("@/components/courses/course-site-header", () => ({
  CourseSiteHeader: () => null,
  CourseSiteFooter: () => null,
}));
vi.mock("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/lib/highlight-code", () => ({ highlightChapterBlocks: async () => [] }));

afterEach(() => {
  cleanup();
  captured.toc.length = 0;
  captured.lessons.length = 0;
});

describe("course chapter route", () => {
  it("uses the guided lesson for Java, DSA, and AI Agents without sending course bodies to the client rail", async () => {
    const chapters = [
      { course: "java", chapter: "what-is-java-and-how-it-runs" },
      { course: "dsa", chapter: "what-is-dsa" },
      { course: "ai-agents", chapter: "what-is-a-language-model" },
    ];

    for (const params of chapters) {
      const element = await ChapterPage({ params: Promise.resolve(params) });
      render(element);
    }

    expect(captured.lessons).toHaveLength(3);
    expect(captured.lessons.every((blocks) => blocks.length > 0)).toBe(true);
    expect(captured.toc).toHaveLength(3);

    for (const course of captured.toc) {
      const payload = JSON.stringify(course);
      expect(payload).not.toContain('"blocks"');
      expect(payload).not.toContain('"summary"');
      expect(payload).not.toContain('"minutes"');
    }
  });
});
