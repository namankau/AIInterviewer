import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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
];

describe("BlockRenderer", () => {
  it("renders every block kind without crashing, accessibly", () => {
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
});
