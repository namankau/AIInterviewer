"use client";

/**
 * Python, run in the candidate's own browser.
 *
 * The plan was a server-side sandbox — Piston, which the API is still built against. Its
 * public instance went whitelist-only in February 2026 and answers 401, and Wandbox was
 * returning `Failed to get uid` from its own sandbox the night this was written. Rather
 * than ship a Run button that does nothing, Python runs here, in WebAssembly.
 *
 * It turns out to be the better answer for this language anyway:
 *
 * - It costs nothing and has no quota, like the browser voice before it.
 * - **The candidate's code never leaves their machine.** A mock interview is a place
 *   people try things they would not push, and shipping that to a third party to be
 *   executed is a promise we would rather not have to make.
 * - There is no network round trip, so Run answers in the time the code takes.
 *
 * Java cannot work this way and still needs the server runner. That is the honest split,
 * and the room says which is which rather than offering a button that fails.
 */

/** Pinned deliberately: an unpinned CDN build changes the interpreter under a candidate. */
const PYODIDE_VERSION = "0.26.4";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export interface PythonRunResult {
  stdout: string;
  stderr: string;
  /** False when the interpreter itself could not be loaded, rather than the code failing. */
  available: boolean;
  message: string | null;
}

interface PyodideApi {
  setStdout: (options: { batched: (line: string) => void }) => void;
  setStderr: (options: { batched: (line: string) => void }) => void;
  setStdin: (options: { stdin: () => string }) => void;
  runPythonAsync: (source: string) => Promise<unknown>;
}

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideApi>;
  }
}

let runtime: Promise<PyodideApi | null> | null = null;

/**
 * The interpreter, loaded once and shared.
 *
 * It is about ten megabytes, so it is fetched when the DSA room opens rather than when
 * Run is first pressed — the candidate should be waiting on their own code, not on a
 * download they did not ask for. A second call while the first is in flight gets the
 * same promise.
 */
export function loadPython(): Promise<PyodideApi | null> {
  if (runtime) return runtime;
  runtime = (async () => {
    if (typeof window === "undefined") return null;
    try {
      if (!window.loadPyodide) await injectScript(`${PYODIDE_URL}pyodide.js`);
      if (!window.loadPyodide) return null;
      return await window.loadPyodide({ indexURL: PYODIDE_URL });
    } catch {
      // Offline, blocked, or the CDN is down. The room falls back to an editor without
      // a Run button, which is what most real onsites are.
      return null;
    }
  })();
  return runtime;
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("pyodide failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pyodide failed to load"));
    document.head.append(script);
  });
}

/**
 * Runs [source] with [stdin] on standard input and collects what it printed.
 *
 * Output is captured rather than the return value used, because the starter programs are
 * complete scripts that print their answer — the same shape a server runner would take,
 * so a problem's test cases work identically whichever executes them.
 */
export async function runPython(source: string, stdin: string): Promise<PythonRunResult> {
  const python = await loadPython();
  if (!python) {
    return {
      stdout: "",
      stderr: "",
      available: false,
      message: "Python could not be loaded here. Talk me through your solution instead.",
    };
  }

  const out: string[] = [];
  const err: string[] = [];
  python.setStdout({ batched: (line) => out.push(line) });
  python.setStderr({ batched: (line) => err.push(line) });

  // Handed over once. A second read returns "", which is what EOF looks like to
  // `sys.stdin.read()` — without it a program that reads twice hangs the tab.
  let remaining = stdin;
  python.setStdin({
    stdin: () => {
      const chunk = remaining;
      remaining = "";
      return chunk;
    },
  });

  try {
    await python.runPythonAsync(source);
  } catch (error) {
    // A traceback is the useful thing here, not a wrapped message. It is the candidate's
    // own bug and they are being watched fixing it.
    err.push(error instanceof Error ? error.message : String(error));
  }

  return {
    stdout: out.join("\n").trim(),
    stderr: err.join("\n").trim(),
    available: true,
    message: null,
  };
}

/** Compares a run's output to what the case expects, ignoring trailing whitespace only. */
export function matchesExpected(stdout: string, expected: string): boolean {
  return stdout.trim() === expected.trim();
}
