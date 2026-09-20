import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Playground } from "@/components/courses/playground";
import type { Block } from "@/content/courses/types";
import type { CodeRunner } from "@/lib/course-code-runner";

/**
 * `getRunner` is the one seam between the playground and an actual interpreter (task 049)
 * — mocking it here is what "no test may hit a live third-party API or download Pyodide"
 * means for this component. Nothing in this file imports `browser-python.ts` or touches a
 * real Worker.
 */
const prepare = vi.fn<CodeRunner["prepare"]>();
const run = vi.fn<CodeRunner["run"]>();

vi.mock("@/lib/course-code-runner", () => ({
  getRunner: (language: string) => (language === "python" ? { prepare, run } : null),
}));

type PlaygroundBlock = Extract<Block, { kind: "playground" }>;

const pythonBlock: PlaygroundBlock = {
  kind: "playground",
  language: "python",
  starter: "print('hi')",
  prompt: "Say hi back.",
  expectedOutput: "hi",
};

const javaBlock: PlaygroundBlock = {
  kind: "playground",
  language: "java",
  starter: "System.out.println(\"hi\");",
};

function cmContent(container: HTMLElement): HTMLElement {
  const el = container.querySelector(".cm-content");
  if (!el) throw new Error("CodeMirror content element not found");
  return el as HTMLElement;
}

describe("Playground", () => {
  beforeEach(() => {
    prepare.mockReset();
    run.mockReset();
  });

  it("never loads the interpreter merely by rendering — only a Run does", () => {
    render(<Playground block={pythonBlock} />);
    expect(prepare).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("shows a loading state while preparing, then runs, then shows output", async () => {
    let resolvePrepare: (ready: boolean) => void = () => {};
    prepare.mockReturnValue(new Promise((resolve) => (resolvePrepare = resolve)));
    run.mockResolvedValue({
      stdout: "hi",
      stderr: "",
      available: true,
      timedOut: false,
      message: null,
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);

    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByRole("button", { name: "Loading Python…" })).toBeInTheDocument();

    resolvePrepare(true);
    expect(await screen.findByText("hi")).toBeInTheDocument();
    expect(await screen.findByText("Matches the expected output.")).toBeInTheDocument();
  });

  it("shows stderr distinctly and does not claim a match when the run errored", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({
      stdout: "",
      stderr: "NameError: name 'x' is not defined",
      available: true,
      timedOut: false,
      message: null,
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/NameError/)).toBeInTheDocument();
    expect(screen.queryByText("Matches the expected output.")).not.toBeInTheDocument();
    expect(screen.queryByText("Does not match the expected output.")).not.toBeInTheDocument();
  });

  it("shows the timeout message plainly rather than silently failing", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({
      stdout: "",
      stderr: "",
      available: true,
      timedOut: true,
      message: "Stopped after 6 seconds — that usually means a loop that never ends.",
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/Stopped after 6 seconds/)).toBeInTheDocument();
  });

  it("edits the source in the editor and Reset restores the original starter", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({ stdout: "hi!", stderr: "", available: true, timedOut: false, message: null });

    const user = userEvent.setup();
    const { container } = render(<Playground block={pythonBlock} />);

    const editor = cmContent(container);
    await user.click(editor);
    await user.type(editor, "!");
    expect(editor.textContent).toContain("!");

    await user.click(screen.getByRole("button", { name: "Reset to original" }));
    expect(editor.textContent).toBe(pythonBlock.starter);
  });

  it("labels the editor and the output region accessibly", () => {
    render(<Playground block={pythonBlock} />);
    expect(screen.getByLabelText("Editable python code")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("is keyboard reachable: Copy, Reset and Run are all real buttons", () => {
    render(<Playground block={pythonBlock} />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to original" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("for Java, explains the gap honestly instead of a fake or unexplained Run control", () => {
    render(<Playground block={javaBlock} />);
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(screen.getByText(/Running Java in the browser isn.t available yet/)).toBeInTheDocument();
    // Copy and Reset still work for Java — only Run is unavailable.
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to original" })).toBeInTheDocument();
  });
});
