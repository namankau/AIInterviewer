"use client";

import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useId, useMemo, useState } from "react";

import { matchesExpected } from "@/lib/browser-python";
import { getRunner } from "@/lib/course-code-runner";
import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";
import { CopyCodeButton } from "@/components/courses/copy-code-button";

type PlaygroundBlockData = Extract<Block, { kind: "playground" }>;

type Phase = "idle" | "loading" | "running";

interface RunOutput {
  stdout: string;
  stderr: string;
  message: string | null;
  timedOut: boolean;
  /** null when there is nothing to compare against, or the run didn't produce a clean result. */
  matchesExpected: boolean | null;
}

/**
 * The "try it yourself" block (task 049): an editable CodeMirror seeded from `block.starter`,
 * Run/Reset, and stdout/stderr shown distinctly.
 *
 * The static, server-rendered code sample right above this (see `block-renderer.tsx`) is
 * what a reader with JS off, or a search engine, actually sees — this component is a
 * progressive-enhancement layer on top of it, never the only copy of the content, per
 * task 049. It never fetches Pyodide on its own: `getRunner().prepare()` below is only
 * ever called from the Run click.
 */
export function Playground({ block }: { block: PlaygroundBlockData }) {
  const [source, setSource] = useState(block.starter);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RunOutput | null>(null);
  const outputId = useId();
  const editorLabel = `Editable ${block.language} code`;

  const runner = useMemo(() => getRunner(block.language), [block.language]);
  const extensions = useMemo(() => [block.language === "java" ? java() : python()], [block.language]);

  const handleRun = useCallback(async () => {
    if (!runner) return;
    setPhase("loading");
    const ready = await runner.prepare();
    if (!ready) {
      setPhase("idle");
      setResult({
        stdout: "",
        stderr: "",
        message: "Python could not be loaded here. Try again, or read through the code instead.",
        timedOut: false,
        matchesExpected: null,
      });
      return;
    }
    setPhase("running");
    const outcome = await runner.run(source);
    setPhase("idle");
    setResult({
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      message: outcome.message,
      timedOut: outcome.timedOut,
      matchesExpected:
        block.expectedOutput && outcome.available && !outcome.timedOut && !outcome.stderr
          ? matchesExpected(outcome.stdout, block.expectedOutput)
          : null,
    });
  }, [runner, source, block.expectedOutput]);

  const handleReset = useCallback(() => {
    setSource(block.starter);
    setResult(null);
  }, [block.starter]);

  return (
    <figure className="rounded-md border border-line-strong bg-surface-raised">
      <figcaption className="border-b border-line-strong bg-surface-sunken px-4 py-3">
        <p className="font-mono text-micro tracking-widest text-accent uppercase">Try it yourself</p>
        {block.prompt ? (
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">
            <InlineText text={block.prompt} />
          </p>
        ) : null}
      </figcaption>

      <div className="min-h-[8rem]">
        <CodeMirror
          value={source}
          extensions={extensions}
          onChange={setSource}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
          aria-label={editorLabel}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line-strong px-4 py-2.5">
        <CopyCodeButton code={source} />

        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-line-strong px-3 py-1.5 text-caption text-ink-muted transition-colors hover:bg-surface-sunken"
        >
          Reset to original
        </button>

        {runner ? (
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={phase !== "idle"}
            aria-describedby={outputId}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-caption font-medium text-accent-contrast transition hover:bg-accent-strong disabled:opacity-50"
          >
            {phase === "loading" ? "Loading Python…" : phase === "running" ? "Running…" : "Run"}
          </button>
        ) : (
          /*
           * Said once, plainly, in place of a Run button — never a disabled control with no
           * explanation, and never "coming soon" hype (task 049).
           */
          <p className="text-caption text-ink-subtle">
            Running Java in the browser isn&rsquo;t available yet — there is no free, unencumbered way to
            do it today. Copy still works; read through the code, or switch to a Python example to run one.
          </p>
        )}
      </div>

      <div id={outputId} role="status" aria-live="polite" className="border-t border-line-strong px-4 py-3">
        {!result && <p className="text-caption text-ink-subtle">Run to see what this prints.</p>}
        {result?.message && <p className="text-caption text-ink-muted">{result.message}</p>}
        {result && !result.message && (
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-ink-subtle">Output</p>
              <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-caption text-ink">
                {result.stdout || "(nothing printed)"}
              </pre>
            </div>
            {result.stderr ? (
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-ink-subtle">Error</p>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-caption text-danger">
                  {result.stderr}
                </pre>
              </div>
            ) : null}
            {result.matchesExpected !== null && (
              <p className={`text-caption ${result.matchesExpected ? "text-positive" : "text-ink-muted"}`}>
                {result.matchesExpected ? "Matches the expected output." : "Does not match the expected output."}
              </p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
