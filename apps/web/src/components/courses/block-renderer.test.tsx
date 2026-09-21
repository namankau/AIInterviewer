import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { BlockRenderer } from "@/components/courses/block-renderer";
import type { Block } from "@/content/courses/types";

const ALL_KINDS: Block[] = [
  { kind: "p", text: "A paragraph with `code` and **bold**." },
  { kind: "h", text: "A sub-heading" },
  { kind: "analogy", title: "A tiffin box", text: "The everyday picture." },
  { kind: "code", code: "System.out.println(1);", caption: "A caption", output: "1" },
  { kind: "list", items: ["one", "two"] },
  { kind: "table", head: ["A", "B"], rows: [["1", "2"]] },
  { kind: "trace", title: "Trace title", steps: ["step one", "step two"] },
  { kind: "pitfall", items: ["A common mistake"] },
  { kind: "remember", items: ["Remember this"] },
  { kind: "interview", items: ["Comes up as X"] },
  {
    kind: "quiz",
    question: "What is 2 + 2?",
    options: ["3", "4", "5"],
    answer: 1,
    why: "Basic arithmetic.",
  },
  {
    kind: "viz",
    title: "A step-through array",
    viz: {
      type: "array",
      frames: [{ cells: [{ value: 1 }, { value: 2 }], note: "Frame one note." }],
    },
  },
  // Java, deliberately: getRunner("java") is null with no mocking needed, so this
  // exercises the real Playground component (real CodeMirror, no Worker involved) in the
  // same no-mock smoke test as every other block kind.
  {
    kind: "playground",
    language: "java",
    starter: "System.out.println(2);",
    prompt: "A prompt line.",
    expectedOutput: "2",
  },
  { kind: "concept", title: "A concept title", text: "The formal rule." },
  {
    kind: "compare",
    title: "A vs B",
    columns: [
      { label: "Column A", items: ["A item one"] },
      { label: "Column B", items: ["B item one"] },
    ],
  },
  {
    kind: "steps",
    title: "A pipeline",
    steps: [
      { label: "Step one", text: "First stage." },
      { label: "Step two", text: "Second stage." },
    ],
  },
];

// The Java/Python choice lives in `localStorage` (module-scoped, not React state — see
// `code-language-context.tsx`) so it outlives a render and must be reset between tests.
afterEach(() => {
  window.localStorage.removeItem("course-code-language");
});

describe("BlockRenderer", () => {
  it("renders every block kind without crashing, accessibly", async () => {
    render(<BlockRenderer blocks={ALL_KINDS} />);

    expect(screen.getByText(/A paragraph with/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A sub-heading" })).toBeInTheDocument();
    expect(screen.getByText("A tiffin box")).toBeInTheDocument();
    expect(screen.getByText("System.out.println(1);")).toBeInTheDocument();
    expect(screen.getByText("A caption")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Trace title")).toBeInTheDocument();
    expect(screen.getByText("A common mistake")).toBeInTheDocument();
    expect(screen.getByText("Remember this")).toBeInTheDocument();
    expect(screen.getByText("Comes up as X")).toBeInTheDocument();
    expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    expect(screen.getByText("A step-through array")).toBeInTheDocument();
    expect(screen.getByText("Frame one note.")).toBeInTheDocument();
    expect(screen.getByText("System.out.println(2);")).toBeInTheDocument();
    // The playground itself is code-split (next/dynamic) so a chapter with no playground
    // block never fetches it — its own content resolves asynchronously here.
    expect(await screen.findByText("A prompt line.")).toBeInTheDocument();
    expect(await screen.findByText(/Running Java in the browser isn.t available yet/)).toBeInTheDocument();
    expect(screen.getByText("A concept title")).toBeInTheDocument();
    expect(screen.getByText("A vs B")).toBeInTheDocument();
    expect(screen.getByText("Column A")).toBeInTheDocument();
    expect(screen.getByText("A pipeline")).toBeInTheDocument();
    expect(screen.getByText("First stage.")).toBeInTheDocument();
  });

  it("caps prose blocks at 70ch but lets full-bleed blocks (viz, code, table, compare, steps, playground) use the full width", () => {
    const { container } = render(
      <BlockRenderer
        blocks={[
          { kind: "p", text: "A paragraph." },
          { kind: "table", head: ["A"], rows: [["1"]] },
          {
            kind: "compare",
            columns: [
              { label: "X", items: ["x"] },
              { label: "Y", items: ["y"] },
            ],
          },
        ]}
      />,
    );

    const wrappers = container.firstElementChild?.children ?? [];
    expect(wrappers[0]?.className).toContain("max-w-[70ch]");
    expect(wrappers[1]?.className).toContain("w-full");
    expect(wrappers[2]?.className).toContain("w-full");
  });

  it("renders inline `code` and **bold** markers as their own elements", () => {
    render(<BlockRenderer blocks={[{ kind: "p", text: "See `Scanner` and **immutable**." }]} />);

    expect(screen.getByText("Scanner", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByText("immutable", { selector: "strong" })).toBeInTheDocument();
  });

  it("gives every h block an anchor id derived from its text", () => {
    render(<BlockRenderer blocks={[{ kind: "h", text: "What Java Is" }]} />);

    expect(screen.getByRole("heading", { name: "What Java Is" })).toHaveAttribute("id", "what-java-is");
  });

  it("reveals the quiz answer only after an option is chosen", async () => {
    const user = userEvent.setup();
    render(
      <BlockRenderer
        blocks={[
          {
            kind: "quiz",
            question: "Pick the right one",
            options: ["Wrong", "Right"],
            answer: 1,
            why: "Because it's right.",
          },
        ]}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Right" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Because it's right\./);
    expect(screen.getByRole("status")).toHaveTextContent(/Correct\./);
  });

  it("marks a wrong pick as not correct, while still revealing why", async () => {
    const user = userEvent.setup();
    render(
      <BlockRenderer
        blocks={[
          {
            kind: "quiz",
            question: "Pick the right one",
            options: ["Wrong", "Right"],
            answer: 1,
            why: "Because it's right.",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Wrong" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Not quite\./);
  });

  it("renders pre-highlighted Shiki HTML for a code block when given, instead of plain text", () => {
    const { container } = render(
      <BlockRenderer
        blocks={[{ kind: "code", code: "int x = 1;" }]}
        highlightedCode={[{ java: '<pre class="shiki" tabindex="0"><code>marked up</code></pre>', python: null }]}
      />,
    );

    expect(container.querySelector(".shiki")).toBeInTheDocument();
    expect(screen.getByText("marked up")).toBeInTheDocument();
  });

  it("shows a Java/Python toggle only when a code block carries a python field, and switches the shown source", async () => {
    const user = userEvent.setup();
    render(
      <BlockRenderer
        blocks={[
          { kind: "code", code: "System.out.println(1);", python: "print(1)", output: "1", pythonOutput: "1" },
        ]}
      />,
    );

    expect(screen.getByText("print(1)")).toBeInTheDocument();
    expect(screen.queryByText("System.out.println(1);")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Java" }));
    expect(screen.getByText("System.out.println(1);")).toBeInTheDocument();
    expect(screen.queryByText("print(1)")).not.toBeInTheDocument();
  });

  it("renders no language toggle for a code block with no python field", () => {
    render(<BlockRenderer blocks={[{ kind: "code", code: "int x = 1;" }]} />);

    expect(screen.queryByRole("button", { name: "Java" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Python" })).not.toBeInTheDocument();
  });

  it("keeps full-bleed blocks from forcing page-level horizontal scroll at mobile width", () => {
    // A `steps` strip is wider than a phone once it has more than a step or two, and a
    // `compare` block has 2-3 columns — neither should widen the page itself. `steps`
    // scrolls its own content (like a code block); `compare` stacks to one column by
    // default and only grows columns from `sm:` up (task 052).
    const { container } = render(
      <BlockRenderer
        blocks={[
          {
            kind: "steps",
            steps: [
              { label: "One", text: "First." },
              { label: "Two", text: "Second." },
              { label: "Three", text: "Third." },
            ],
          },
          {
            kind: "compare",
            columns: [
              { label: "X", items: ["x"] },
              { label: "Y", items: ["y"] },
              { label: "Z", items: ["z"] },
            ],
          },
        ]}
      />,
    );

    const stepsList = container.querySelector("ol.overflow-x-auto");
    expect(stepsList).toBeInTheDocument();

    const compareGrid = container.querySelector(".grid.grid-cols-1");
    expect(compareGrid).toBeInTheDocument();
    expect(compareGrid?.className).not.toMatch(/(?<!sm:)grid-cols-[23]\b/);
  });

  it("falls back to a plain, unhighlighted <pre> when no highlighted HTML is given", () => {
    const { container } = render(<BlockRenderer blocks={[{ kind: "code", code: "int x = 1;" }]} />);

    expect(container.querySelector(".shiki")).not.toBeInTheDocument();
    expect(screen.getByText("int x = 1;")).toBeInTheDocument();
  });
});
