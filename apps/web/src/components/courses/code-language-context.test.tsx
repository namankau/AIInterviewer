import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { BlockRenderer } from "@/components/courses/block-renderer";
import { CodeLanguageProvider } from "@/components/courses/code-language-context";
import type { Block } from "@/content/courses/types";

/**
 * Task 050: the Java/Python toggle on a `code` block is a shared choice, not a per-block
 * one — picking Python on one block and reading Java on the next would be a worse chapter
 * than always Java. These tests exercise that behaviour through `BlockRenderer` wrapped in
 * the real `CodeLanguageProvider`, the way a chapter page actually renders it, rather than
 * unit-testing the toggle in isolation.
 */

const twoBlocks: Block[] = [
  { kind: "code", code: "System.out.println(1);", python: "print(1)", output: "1", pythonOutput: "1" },
  { kind: "code", code: "System.out.println(2);", python: "print(2)", output: "2", pythonOutput: "2" },
];

// The language choice lives in `localStorage` (a real external store, module-scoped, not
// React state — see `code-language-context.tsx`), so it outlives any one render and must
// be reset between tests here or a later test would inherit an earlier one's choice.
afterEach(() => {
  window.localStorage.removeItem("course-code-language");
});

describe("code language switching across a page", () => {
  it("defaults every code block on the page to Python", () => {
    render(
      <CodeLanguageProvider>
        <BlockRenderer blocks={twoBlocks} />
      </CodeLanguageProvider>,
    );

    expect(screen.getByText("print(1)")).toBeInTheDocument();
    expect(screen.getByText("print(2)")).toBeInTheDocument();
  });

  it("switches every code block on the page together when one toggle is used", async () => {
    const user = userEvent.setup();
    render(
      <CodeLanguageProvider>
        <BlockRenderer blocks={twoBlocks} />
      </CodeLanguageProvider>,
    );

    const javaButtons = screen.getAllByRole("button", { name: "Java" });
    expect(javaButtons).toHaveLength(2);

    // Clicking the FIRST block's Java toggle switches the second block too.
    await user.click(javaButtons[0]!);

    expect(screen.getByText("System.out.println(1);")).toBeInTheDocument();
    expect(screen.getByText("System.out.println(2);")).toBeInTheDocument();
    expect(screen.queryByText("print(1)")).not.toBeInTheDocument();
    expect(screen.queryByText("print(2)")).not.toBeInTheDocument();
  });

  it("labels each toggle button and marks the active language with aria-pressed", () => {
    render(
      <CodeLanguageProvider>
        <BlockRenderer blocks={[twoBlocks[0]!]} />
      </CodeLanguageProvider>,
    );

    const pythonButton = screen.getByRole("button", { name: "Python" });
    const javaButton = screen.getByRole("button", { name: "Java" });
    expect(pythonButton).toHaveAttribute("aria-pressed", "true");
    expect(javaButton).toHaveAttribute("aria-pressed", "false");
  });

  it("is reachable and operable by keyboard alone", async () => {
    const user = userEvent.setup();
    render(
      <CodeLanguageProvider>
        <BlockRenderer blocks={[twoBlocks[0]!]} />
      </CodeLanguageProvider>,
    );

    expect(screen.getByText("print(1)")).toBeInTheDocument();

    // The language toggle sits in the figcaption, before the copy button in DOM order, so
    // it's the first stop when tabbing into the block. Activate it with the keyboard
    // alone — no click.
    await user.tab();
    const javaButton = screen.getByRole("button", { name: "Java" });
    expect(javaButton).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("System.out.println(1);")).toBeInTheDocument();
  });

  it("renders no toggle, and always Java, for a code block with no python field", () => {
    render(
      <CodeLanguageProvider>
        <BlockRenderer blocks={[{ kind: "code", code: "int x = 1;" }]} />
      </CodeLanguageProvider>,
    );

    expect(screen.getByText("int x = 1;")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Java" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Python" })).not.toBeInTheDocument();
  });
});
