import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildGuidedLessonBeats, GuidedLesson } from "@/components/courses/guided-lesson";
import type { Block } from "@/content/courses/types";

const THREE_COURSE_BLOCKS: Block[] = [
  { kind: "p", text: "Java starts by turning source into bytecode." },
  { kind: "analogy", title: "A universal instruction sheet", text: "One recipe can work in many kitchens." },
  {
    kind: "quiz",
    question: "What should happen before you reveal the Java answer?",
    options: ["Predict", "Skip"],
    answer: 0,
    why: "Prediction makes the explanation active.",
  },
  {
    kind: "viz",
    title: "DSA pointer movement",
    viz: { type: "array", frames: [{ cells: [{ value: 2, pointers: ["left"] }, { value: 8 }], note: "Move left." }] },
  },
  { kind: "agentlab", scenarioId: "refund-status" },
  { kind: "remember", items: ["AI agents need observations, not guesses."] },
  {
    kind: "quiz",
    question: "What proves the lesson stuck?",
    options: ["A final check", "More scrolling"],
    answer: 0,
    why: "Retrieval is stronger than rereading.",
  },
];

describe("GuidedLesson", () => {
  it("moves through all five beats with accessible buttons and continue controls", async () => {
    const user = userEvent.setup();
    render(<GuidedLesson blocks={THREE_COURSE_BLOCKS} />);

    expect(screen.getByText("Beat 1 of 5")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-beat-see")).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Take a first guess" }));
    expect(screen.getByText("Beat 2 of 5")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-beat-predict")).toHaveAttribute("open");
    expect(screen.getByTestId("lesson-beat-see")).not.toHaveAttribute("open");

    await user.click(within(screen.getByTestId("lesson-beat-predict")).getByRole("button", { name: "Continue to Try it" }));
    expect(screen.getByText("Beat 3 of 5")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-beat-interact")).toHaveAttribute("open");
  });

  it("keeps every authored block in the initial HTML, including closed beats", () => {
    const html = renderToStaticMarkup(<GuidedLesson blocks={THREE_COURSE_BLOCKS} />);

    expect(html).toContain("Java starts by turning source into bytecode.");
    expect(html).toContain("What should happen before you reveal the Java answer?");
    expect(html).toContain("DSA pointer movement");
    expect(html).toContain("AI agents need observations, not guesses.");
    expect(html).toContain("What proves the lesson stuck?");
    expect(html).toContain('data-testid="lesson-beat-check"');
  });

  it("covers Java, DSA, and AI-agent content through the same generic presentation", () => {
    render(<GuidedLesson blocks={THREE_COURSE_BLOCKS} />);

    expect(screen.getByText(/Java starts/)).toBeInTheDocument();
    expect(screen.getByText("DSA pointer movement")).toBeInTheDocument();
    expect(screen.getByText(/AI agents need observations/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /See the idea|Take a first guess|Try it yourself|Explain and remember|Final checkpoint/ })).toHaveLength(5);
  });

  it("does not pull the course-content barrel into the client bundle", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/courses/guided-lesson.tsx"), "utf8");
    const controlsSource = readFileSync(resolve(process.cwd(), "src/components/courses/guided-lesson-controls.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/content\/courses["']/);
    expect(controlsSource).not.toMatch(/@\/content\/courses/);
    expect(source).toContain('import type { Block } from "@/content/courses/types"');
  });

  it("keeps highlighted code aligned after semantic grouping", () => {
    const blocks: Block[] = [
      { kind: "p", text: "Intro" },
      { kind: "code", code: "System.out.println(7);" },
      { kind: "remember", items: ["Seven"] },
    ];
    const highlighted = [null, { base: '<pre class="shiki"><code>aligned marker</code></pre>', python: null }, null];
    render(<GuidedLesson blocks={blocks} highlightedCode={highlighted} />);

    expect(screen.getByText("aligned marker")).toBeInTheDocument();
  });

  it("preserves the authored order of every block except the deliberate first-quiz diagnostic", () => {
    const intro: Block = { kind: "p", text: "Intro" };
    const heading: Block = { kind: "h", text: "Why the example works" };
    const explanation: Block = { kind: "p", text: "Explanation before example" };
    const code: Block = { kind: "code", code: "print('example')" };
    const laterExplanation: Block = { kind: "p", text: "Explanation after example" };
    const firstQuiz: Block = { kind: "quiz", question: "First?", options: ["Yes"], answer: 0, why: "Yes" };
    const secondQuiz: Block = { kind: "quiz", question: "Second?", options: ["Yes"], answer: 0, why: "Yes" };
    const practice: Block = { kind: "list", items: ["Try it"] };
    const blocks = [intro, heading, explanation, code, laterExplanation, firstQuiz, secondQuiz, practice];

    const beats = buildGuidedLessonBeats(blocks, []);
    const flattened = beats
      .filter((beat) => beat.key !== "predict")
      .flatMap((beat) => beat.blocks.map(({ block }) => block));

    expect(flattened).toEqual(blocks.filter((block) => block !== firstQuiz));
    expect(beats.find((beat) => beat.key === "predict")?.blocks[0]?.block).toBe(firstQuiz);
  });

  it("keeps the active details panel aligned with the beat indicator", async () => {
    const user = userEvent.setup();
    render(<GuidedLesson blocks={THREE_COURSE_BLOCKS} />);

    await user.click(screen.getByText("See the idea"));

    expect(screen.getByText("Beat 1 of 5")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-beat-see")).toHaveAttribute("open");
  });
});
