"use client";

import type { Block } from "@/content/courses/types";
import type { CodeBlockHighlight } from "@/lib/highlight-code";
import { CopyCodeButton } from "@/components/courses/copy-code-button";
import { useCodeLanguage, type CodeLanguage } from "@/components/courses/code-language-context";

type CodeBlockData = Extract<Block, { kind: "code" }>;

function StaticCode({ code, html }: { code: string; html: string | null }) {
  return html ? (
    <div className="shiki-wrap overflow-x-auto px-4 py-4" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="overflow-x-auto bg-surface-raised px-4 py-4 font-mono text-caption text-ink">
      <code>{code}</code>
    </pre>
  );
}

/**
 * A `code` block with a Python equivalent (task 050): a Java/Python toggle above the
 * source, sharing one choice across the whole page via `CodeLanguageProvider`. A block with
 * no `python` field (every Java-course chapter, and the handful of DSA blocks whose point
 * is Java-specific) renders as a single static sample with no tabs at all — unchanged from
 * before this task.
 *
 * The toggle is a two-button group (`aria-pressed`, not a full ARIA tablist with roving
 * tabindex) — plain, natively focusable `<button>`s that reach every requirement task 050
 * actually asks for (keyboard reachable, labelled) without hand-rolling arrow-key
 * navigation for two options.
 */
export function CodeBlock({ block, highlighted }: { block: CodeBlockData; highlighted: CodeBlockHighlight | null }) {
  const { language, setLanguage } = useCodeLanguage();
  const hasPython = Boolean(block.python);
  // A block with no Python variant always shows Java, regardless of the page's shared
  // choice — there's nothing to switch to.
  const shown: CodeLanguage = hasPython ? language : "java";

  const code = shown === "python" && block.python ? block.python : block.code;
  const output = shown === "python" ? block.pythonOutput : block.output;
  const html = shown === "python" ? (highlighted?.python ?? null) : (highlighted?.java ?? null);

  return (
    <figure className="flex flex-col gap-0 overflow-hidden rounded-md border border-line-strong">
      {(block.caption || hasPython || block.pythonNote) ? (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line-strong bg-surface-sunken px-4 py-2">
          {block.caption ? <span className="text-caption text-ink-muted">{block.caption}</span> : <span />}
          {hasPython ? (
            <div role="group" aria-label="Code language" className="flex gap-1">
              <button
                type="button"
                aria-pressed={shown === "java"}
                onClick={() => setLanguage("java")}
                className={`rounded-md px-2.5 py-1 text-micro font-medium tracking-wide uppercase transition-colors ${
                  shown === "java" ? "bg-accent text-accent-contrast" : "text-ink-muted hover:bg-surface-raised"
                }`}
              >
                Java
              </button>
              <button
                type="button"
                aria-pressed={shown === "python"}
                onClick={() => setLanguage("python")}
                className={`rounded-md px-2.5 py-1 text-micro font-medium tracking-wide uppercase transition-colors ${
                  shown === "python" ? "bg-accent text-accent-contrast" : "text-ink-muted hover:bg-surface-raised"
                }`}
              >
                Python
              </button>
            </div>
          ) : null}
        </figcaption>
      ) : null}
      <div className="relative">
        <StaticCode code={code} html={html} />
        <CopyCodeButton code={code} />
      </div>
      {output ? (
        <div className="border-t border-line-strong bg-surface-sunken px-4 py-3">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Output</p>
          <pre className="mt-1 overflow-x-auto font-mono text-caption text-ink-muted">{output}</pre>
        </div>
      ) : null}
      {shown === "java" && block.pythonNote ? (
        <div className="border-t border-line-strong px-4 py-3">
          <p className="font-mono text-micro tracking-widest text-accent uppercase">Python has no direct equivalent</p>
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">{block.pythonNote}</p>
        </div>
      ) : null}
    </figure>
  );
}
