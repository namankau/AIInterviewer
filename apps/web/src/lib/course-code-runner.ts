"use client";

import { loadPython, runPython } from "@/lib/browser-python";

export type PlaygroundLanguage = "python" | "java";

export interface RunOutcome {
  stdout: string;
  stderr: string;
  /** False when the interpreter itself could not be loaded, rather than the code failing. */
  available: boolean;
  /** True when the run was stopped for taking too long — most likely an endless loop. */
  timedOut: boolean;
  message: string | null;
}

export interface CodeRunner {
  /**
   * Starts loading whatever the runner needs. Never called on mount — only from the
   * playground's own Run/enable handler — so opening a chapter never fetches an
   * interpreter nobody asked for yet (task 049's main perf risk).
   */
  prepare(): Promise<boolean>;
  run(source: string): Promise<RunOutcome>;
}

const pythonRunner: CodeRunner = {
  prepare: () => loadPython(),
  run: (source) => runPython(source, ""),
};

/**
 * One runner per supported language — the pluggable seam task 049 asks for. Python is the
 * only implementation today; a server-side Java runner, when the owner green-lights one,
 * plugs in here as a second `CodeRunner` rather than a rewrite of the playground UI.
 *
 * `null` for Java is not a bug to work around: there is no free, unencumbered way to run
 * Java in a browser as of Feb 2026 (Piston went whitelist-only, self-hosting needs a
 * privileged Docker sidecar, Judge0 is GPLv3 with an unresolved API-use question, CheerpJ
 * needs a commercial licence, DoppioJVM is dead, TeaVM's class-library support is
 * partial). The playground shows that honestly instead of a fake Run button.
 */
export function getRunner(language: PlaygroundLanguage): CodeRunner | null {
  if (language === "python") return pythonRunner;
  return null;
}
