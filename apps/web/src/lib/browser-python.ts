"use client";

/**
 * Python, run in the candidate's own browser — in a Web Worker, never on the page.
 *
 * It used to run on the page's main thread, and a Run could freeze the whole room: the
 * clock stopped, nothing was clickable, and the only way out was closing the tab. Two
 * things caused it, and either was enough:
 *
 * - **Python execution is synchronous.** Pyodide's `runPythonAsync` is async only for
 *   imports; the code itself runs to completion on whatever thread called it. Any loop
 *   that does not terminate — the commonest bug in an interview — blocked the page for
 *   ever. On the main thread that means the interview, not just the editor.
 * - **stdin was fed through a callback that returned `""` for EOF.** Pyodide treats
 *   `null`/`undefined` as EOF, so `sys.stdin.read()` could spin asking for more input.
 *
 * So: the interpreter lives in a worker, where a stuck program can only stall the worker;
 * every run has a hard deadline, and a run that misses it has its worker terminated and
 * replaced; and stdin is an in-memory stream, which has an unambiguous end.
 *
 * Verified against the sandbox that checks each problem's expected outputs: the same
 * programs on the same inputs printed the same thing here, case for case.
 *
 * Why the browser at all: there is no free hosted sandbox any more (Piston went
 * whitelist-only in February 2026), the candidate's code never leaves their machine, and
 * there is no round trip. Java cannot run this way and still needs a server runner.
 */

/** Pinned deliberately: an unpinned CDN build changes the interpreter under a candidate. */
const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * How long a candidate's program may run before it is stopped.
 *
 * Interview problems finish in milliseconds when they are right, so anything near this
 * is a loop that does not end, and saying so quickly is more useful than waiting.
 */
export const RUN_TIMEOUT_MS = 6_000;

/** How long loading the interpreter may take — ten megabytes over whatever the network is. */
const LOAD_TIMEOUT_MS = 90_000;

export interface PythonRunResult {
  stdout: string;
  stderr: string;
  /** False when the interpreter could not be loaded, rather than the code failing. */
  available: boolean;
  /** True when the program was stopped for running past [RUN_TIMEOUT_MS]. */
  timedOut: boolean;
  message: string | null;
}

/*
 * The worker's own source. Built from a string and a Blob URL rather than a separate
 * bundled file, so it does not depend on how this version of Next resolves
 * `new URL(..., import.meta.url)` for workers — it is plain JavaScript either way.
 */
const WORKER_SOURCE = `
self.importScripts("${PYODIDE_URL}pyodide.js");
const ready = loadPyodide({ indexURL: "${PYODIDE_URL}" });

self.onmessage = async (event) => {
  const { id, type, source, stdin } = event.data;
  let py;
  try {
    py = await ready;
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
    return;
  }
  if (type === "warm") {
    self.postMessage({ id, ok: true });
    return;
  }

  const out = [];
  const err = [];
  py.setStdout({ batched: (line) => out.push(line) });
  py.setStderr({ batched: (line) => err.push(line) });

  // A fresh namespace per run, so one Run's leftover globals cannot change the next.
  const globals = py.globals.get("dict")();
  globals.set("__name__", "__main__");
  globals.set("__acemy_stdin__", stdin);
  try {
    // A real text stream over bytes rather than a StringIO: it has a definite end, and it
    // has .buffer, so sys.stdin.buffer.read() works here exactly as it does on the server
    // that checks the problem's expected outputs.
    await py.runPythonAsync(
      "import sys, io\\nsys.stdin = io.TextIOWrapper(io.BytesIO(__acemy_stdin__.encode()), encoding='utf-8')",
      { globals },
    );
    await py.runPythonAsync(source, { globals });
  } catch (error) {
    err.push(error && error.message ? error.message : String(error));
  } finally {
    globals.destroy();
  }
  self.postMessage({ id, ok: true, stdout: out.join("\\n"), stderr: err.join("\\n") });
};
`;

type WorkerReply = { id: number; ok: boolean; stdout?: string; stderr?: string; error?: string };

let worker: Worker | null = null;
let warming: Promise<boolean> | null = null;
let nextId = 0;

function spawn(): Worker {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  const created = new Worker(url);
  URL.revokeObjectURL(url);
  return created;
}

/** Sends one message and waits for its reply, or for [timeoutMs] — whichever is first. */
function ask(target: Worker, message: object, timeoutMs: number): Promise<WorkerReply | "timeout" | "crashed"> {
  const id = ++nextId;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve("timeout");
    }, timeoutMs);
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data?.id !== id) return;
      cleanup();
      resolve(event.data);
    };
    const onError = () => {
      cleanup();
      resolve("crashed");
    };
    function cleanup() {
      window.clearTimeout(timer);
      target.removeEventListener("message", onMessage);
      target.removeEventListener("error", onError);
    }
    target.addEventListener("message", onMessage);
    target.addEventListener("error", onError);
    target.postMessage({ id, ...message });
  });
}

/** Throws away the current interpreter. The next call starts a fresh one. */
function discard() {
  worker?.terminate();
  worker = null;
  warming = null;
}

/**
 * Starts the interpreter loading, off the page, and resolves true once it can run code.
 *
 * Called when the DSA room opens, so the candidate waits on their own code rather than
 * on a download they did not ask for. Repeated calls share one load.
 */
export function loadPython(): Promise<boolean> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return Promise.resolve(false);
  if (warming) return warming;
  worker = spawn();
  const current = worker;
  warming = ask(current, { type: "warm" }, LOAD_TIMEOUT_MS).then((reply) => {
    const ok = typeof reply === "object" && reply.ok;
    if (!ok && worker === current) discard();
    return ok;
  });
  return warming;
}

/**
 * Runs [source] with [stdin] on standard input and collects what it printed.
 *
 * Never blocks the page and never takes longer than [RUN_TIMEOUT_MS] once the interpreter
 * is loaded. A program that overruns has its worker terminated — the only way to stop
 * running Python — and a fresh one starts loading at once, so the next Run is ready.
 */
export async function runPython(source: string, stdin: string): Promise<PythonRunResult> {
  const ready = await loadPython();
  if (!ready || !worker) {
    return {
      stdout: "",
      stderr: "",
      available: false,
      timedOut: false,
      message: "Python could not be loaded here. Talk me through your solution instead.",
    };
  }

  const reply = await ask(worker, { type: "run", source, stdin }, RUN_TIMEOUT_MS);

  if (reply === "timeout" || reply === "crashed") {
    discard();
    void loadPython();
    return {
      stdout: "",
      stderr: "",
      available: true,
      timedOut: reply === "timeout",
      message:
        reply === "timeout"
          ? `Stopped after ${RUN_TIMEOUT_MS / 1000} seconds — that usually means a loop that never ends. ` +
            "Your code is untouched; Python is restarting for the next run."
          : "Python stopped unexpectedly. Your code is untouched; it is restarting for the next run.",
    };
  }

  if (!reply.ok) {
    discard();
    return {
      stdout: "",
      stderr: "",
      available: false,
      timedOut: false,
      message: "Python could not be loaded here. Talk me through your solution instead.",
    };
  }

  return {
    stdout: (reply.stdout ?? "").trim(),
    stderr: (reply.stderr ?? "").trim(),
    available: true,
    timedOut: false,
    message: null,
  };
}

/**
 * Compares a run's output to what the case expects.
 *
 * Line endings and trailing spaces do not count; anything else does — `[1,2]` is not
 * `[1, 2]`. The same rule the server applies when it checks the expected outputs by
 * running two solutions, so a case it verified cannot fail here on formatting alone.
 */
export function matchesExpected(stdout: string, expected: string): boolean {
  return normaliseOutput(stdout) === normaliseOutput(expected);
}

function normaliseOutput(output: string): string {
  return output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
