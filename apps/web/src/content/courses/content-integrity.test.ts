import { describe, expect, it } from "vitest";

import { courses, flattenChapters, getAdjacentChapters } from "@/content/courses";
import type {
  ArrayFrame,
  Block,
  Chapter,
  Course,
  GraphFrame,
  GridFrame,
  ListFrame,
  TreeFrame,
} from "@/content/courses/types";

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

    it("every viz block has non-empty frames, each with a note, and in-range references", () => {
      const vizBlocks = blocksOf("viz", chapter) as Extract<Block, { kind: "viz" }>[];
      for (const block of vizBlocks) {
        expect(block.title.trim().length).toBeGreaterThan(0);
        const frames = block.viz.frames;
        expect(frames.length).toBeGreaterThan(0);
        for (const frame of frames) {
          expect(frame.note.trim().length).toBeGreaterThan(0);

          if (block.viz.type === "array") {
            const arrayFrame = frame as ArrayFrame;
            expect(arrayFrame.cells.length).toBeGreaterThan(0);
            if (arrayFrame.range) {
              const [start, end] = arrayFrame.range;
              expect(start).toBeGreaterThanOrEqual(0);
              expect(end).toBeLessThan(arrayFrame.cells.length);
              expect(start).toBeLessThanOrEqual(end);
            }
          }

          if (block.viz.type === "list") {
            const listFrame = frame as ListFrame;
            expect(listFrame.nodes.length).toBeGreaterThan(0);
            const ids = new Set(listFrame.nodes.map((n) => n.id));
            for (const node of listFrame.nodes) {
              if (node.next !== null) {
                expect(ids.has(node.next)).toBe(true);
              }
            }
          }

          if (block.viz.type === "tree") {
            const treeFrame = frame as TreeFrame;
            const ids = new Set(treeFrame.nodes.map((n) => n.id));
            expect(ids.has(treeFrame.rootId)).toBe(true);
            for (const node of treeFrame.nodes) {
              if (node.left !== null) expect(ids.has(node.left)).toBe(true);
              if (node.right !== null) expect(ids.has(node.right)).toBe(true);
            }
          }

          if (block.viz.type === "graph") {
            const graphFrame = frame as GraphFrame;
            const ids = new Set(graphFrame.nodes.map((n) => n.id));
            for (const edge of graphFrame.edges) {
              expect(ids.has(edge.from)).toBe(true);
              expect(ids.has(edge.to)).toBe(true);
            }
          }

          if (block.viz.type === "table") {
            const gridFrame = frame as GridFrame;
            expect(gridFrame.rows.length).toBeGreaterThan(0);
            if (gridFrame.highlight) {
              for (const [r, c] of gridFrame.highlight) {
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThan(gridFrame.rows.length);
                const row = gridFrame.rows[r];
                expect(row).toBeDefined();
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThan((row ?? []).length);
              }
            }
          }
        }
      }
    });

    it("every concept card has a non-empty title and text", () => {
      const concepts = blocksOf("concept", chapter) as Extract<Block, { kind: "concept" }>[];
      for (const block of concepts) {
        expect(block.title.trim().length).toBeGreaterThan(0);
        expect(block.text.trim().length).toBeGreaterThan(0);
      }
    });

    it("every compare block has 2-3 labelled columns, each with at least one item", () => {
      const compares = blocksOf("compare", chapter) as Extract<Block, { kind: "compare" }>[];
      for (const block of compares) {
        expect(block.columns.length).toBeGreaterThanOrEqual(2);
        expect(block.columns.length).toBeLessThanOrEqual(3);
        for (const column of block.columns) {
          expect(column.label.trim().length).toBeGreaterThan(0);
          expect(column.items.length).toBeGreaterThan(0);
          for (const item of column.items) {
            expect(item.trim().length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("every steps block has at least 2 stages, each with a non-empty label and text", () => {
      const stepsBlocks = blocksOf("steps", chapter) as Extract<Block, { kind: "steps" }>[];
      for (const block of stepsBlocks) {
        expect(block.steps.length).toBeGreaterThanOrEqual(2);
        for (const step of block.steps) {
          expect(step.label.trim().length).toBeGreaterThan(0);
          expect(step.text.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it("every playground block has non-empty starter source, and Python ones a runnable-looking expected output", () => {
      const playgrounds = blocksOf("playground", chapter) as Extract<Block, { kind: "playground" }>[];
      for (const block of playgrounds) {
        expect(block.starter.trim().length).toBeGreaterThan(0);
        expect(["python", "java"]).toContain(block.language);
        if (block.expectedOutput !== undefined) {
          expect(block.expectedOutput.length).toBeGreaterThan(0);
        }
      }
    });

    // DSA-specific rules (task 046): every algorithm gets a dry-run trace and a complexity table, and
    // ends with 3-5 practice problems in our own words, flagged by a "Practice problems" heading.
    if (course.slug === "dsa") {
      // A `viz` block is the picture the same dry run would otherwise be told in prose
      // (task 047) — either satisfies "walks through a small input step by step".
      it("has at least one trace or viz block (a dry run on a small input)", () => {
        expect(blocksOf("trace", chapter).length + blocksOf("viz", chapter).length).toBeGreaterThanOrEqual(1);
      });

      it("has at least one complexity table with a reason in every row", () => {
        const tables = blocksOf("table", chapter) as Extract<Block, { kind: "table" }>[];
        expect(tables.length).toBeGreaterThanOrEqual(1);
        for (const table of tables) {
          for (const row of table.rows) {
            const reason = row[row.length - 1] ?? "";
            expect(reason.trim().length).toBeGreaterThan(0);
          }
        }
      });

      // Task 050: every DSA code block gets a Python equivalent, switchable in the reader,
      // unless the block's teaching point is genuinely Java-specific — in which case
      // `pythonNote` says so instead of forcing a misleading parallel. Exactly one of the
      // two must be set, never neither and never both.
      it("has a python field or an honest pythonNote on every code block, and real, non-guessed output for both", () => {
        const codeBlocks = blocksOf("code", chapter) as Extract<Block, { kind: "code" }>[];
        for (const block of codeBlocks) {
          const hasPython = Boolean(block.python && block.python.trim().length > 0);
          const hasNote = Boolean(block.pythonNote && block.pythonNote.trim().length > 0);
          expect(hasPython || hasNote).toBe(true);
          expect(hasPython && hasNote).toBe(false);
          if (hasPython && block.output) {
            expect((block.pythonOutput ?? "").trim().length).toBeGreaterThan(0);
          }
        }
      });

      it("ends with a 'Practice problems' heading followed by 3-5 problems in our own words", () => {
        const headingIndex = chapter.blocks.findIndex((b) => b.kind === "h" && b.text === "Practice problems");
        expect(headingIndex).toBeGreaterThanOrEqual(0);
        const next = chapter.blocks[headingIndex + 1];
        expect(next?.kind).toBe("list");
        const practice = next as Extract<Block, { kind: "list" }>;
        expect(practice.items.length).toBeGreaterThanOrEqual(3);
        expect(practice.items.length).toBeLessThanOrEqual(5);
        for (const item of practice.items) {
          expect(item.trim().length).toBeGreaterThan(0);
        }
      });
    }
  });
});
