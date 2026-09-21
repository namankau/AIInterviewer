import { describe, expect, it, vi } from "vitest";

const loadPython = vi.fn();
const runPython = vi.fn();

// The boundary this whole abstraction exists to sit behind — no Worker, no Pyodide, no
// network fetch is ever touched by this test (task 049).
vi.mock("@/lib/browser-python", () => ({ loadPython, runPython }));

describe("getRunner", () => {
  it("returns null for java — there is no runner to plug in yet", async () => {
    const { getRunner } = await import("@/lib/course-code-runner");
    expect(getRunner("java")).toBeNull();
  });

  it("returns a python runner whose prepare() delegates to loadPython", async () => {
    loadPython.mockResolvedValueOnce(true);
    const { getRunner } = await import("@/lib/course-code-runner");
    const runner = getRunner("python");
    expect(runner).not.toBeNull();

    const ready = await runner!.prepare();

    expect(ready).toBe(true);
    expect(loadPython).toHaveBeenCalledTimes(1);
    expect(runPython).not.toHaveBeenCalled();
  });

  it("run() delegates to runPython with empty stdin, and does not call loadPython itself", async () => {
    runPython.mockResolvedValueOnce({
      stdout: "42",
      stderr: "",
      available: true,
      timedOut: false,
      message: null,
    });
    const { getRunner } = await import("@/lib/course-code-runner");
    const runner = getRunner("python")!;
    loadPython.mockClear();

    const outcome = await runner.run("print(42)");

    expect(runPython).toHaveBeenCalledWith("print(42)", "");
    expect(outcome.stdout).toBe("42");
    expect(loadPython).not.toHaveBeenCalled();
  });
});
