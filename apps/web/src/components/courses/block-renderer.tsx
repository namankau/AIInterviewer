import { anchorId } from "@/content/courses/anchor";
import type { Block } from "@/content/courses/types";
import type { CodeBlockHighlight } from "@/lib/highlight-code";
import { QuizBlock } from "@/components/courses/quiz-block";
import { VizBlock } from "@/components/courses/viz-block";
import { PlaygroundLazy } from "@/components/courses/playground-lazy";
import { CodeBlock } from "@/components/courses/code-block";
import { CopyCodeButton } from "@/components/courses/copy-code-button";
import { InlineText } from "@/components/courses/inline-text";

/**
 * Renders one chapter's blocks in order, each block kind styled deliberately (task 045).
 *
 * A chapter is not free-form prose — it's a fixed set of block kinds (paragraph, analogy,
 * code, trace, pitfall, remember, interview, quiz, ...) — so each one gets its own visual
 * treatment rather than falling back to generic article styling. An analogy reads as a
 * tinted aside; a pitfall reads as a warning; a remember box is the one thing on the page
 * that's meant to be skimmable on its own, after everything else is forgotten.
 *
 * `highlightedCode`, when given, is server/build-time Shiki HTML for the `code` and
 * `playground` blocks, aligned by index with `blocks` (task 049) — computed once by the
 * page before this renders, so this component itself stays a plain, synchronous function
 * that a test can render directly. A missing entry (or no `highlightedCode` at all, as in
 * every existing test) falls back to a plain `<pre>` — the same degrade-gracefully path an
 * unrecognised language takes.
 */
export function BlockRenderer({
  blocks,
  highlightedCode,
}: {
  blocks: Block[];
  highlightedCode?: Array<string | CodeBlockHighlight | null>;
}) {
  return (
    <div className="flex flex-col gap-8">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} highlighted={highlightedCode?.[index] ?? null} />
      ))}
    </div>
  );
}

function StaticCode({ code, html }: { code: string; html: string | null }) {
  return html ? (
    // Shiki's own HTML — trusted, generated at build time from our own content files,
    // never from anything a reader submits.
    <div className="shiki-wrap overflow-x-auto px-4 py-4" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <pre className="overflow-x-auto bg-surface-raised px-4 py-4 font-mono text-caption text-ink">
      <code>{code}</code>
    </pre>
  );
}

function BlockView({
  block,
  highlighted,
}: {
  block: Block;
  highlighted: string | CodeBlockHighlight | null;
}) {
  // `code` blocks get a `CodeBlockHighlight` object, `playground` blocks a plain string
  // (task 049/050 — see `highlightChapterBlocks`). Guard once, here, rather than in each case.
  const highlightedHtml = typeof highlighted === "string" ? highlighted : null;
  const highlightedCodeBlock = highlighted && typeof highlighted === "object" ? highlighted : null;
  switch (block.kind) {
    case "p":
      return (
        <p className="text-body leading-relaxed text-ink-muted">
          <InlineText text={block.text} />
        </p>
      );

    case "h":
      return (
        <h2
          id={anchorId(block.text)}
          className="scroll-mt-24 text-title text-ink"
        >
          <InlineText text={block.text} />
        </h2>
      );

    case "analogy":
      return (
        <aside className="rounded-md border border-line bg-accent-wash px-5 py-4">
          <p className="font-mono text-micro tracking-widest text-accent uppercase">The picture</p>
          <p className="mt-2 text-heading text-ink"><InlineText text={block.title} /></p>
          <p className="mt-2 text-body leading-relaxed text-ink-muted">
            <InlineText text={block.text} />
          </p>
        </aside>
      );

    case "code":
      return <CodeBlock block={block} highlighted={highlightedCodeBlock} />;

    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-body leading-relaxed text-ink-muted">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5 text-body leading-relaxed text-ink-muted">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-caption">
            <thead>
              <tr className="border-b border-line-strong bg-surface-sunken text-left">
                {block.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-medium text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-ink-muted">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "trace":
      return (
        <div className="rounded-md border border-line">
          <p className="border-b border-line bg-surface-sunken px-4 py-2 text-caption font-medium text-ink">
            <InlineText text={block.title} />
          </p>
          <ol className="flex flex-col gap-2.5 px-4 py-4">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-caption leading-relaxed text-ink-muted">
                <span className="shrink-0 font-mono text-micro text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <InlineText text={step} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "pitfall":
      return (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-5 py-4">
          <p className="font-mono text-micro tracking-widest text-danger uppercase">Common mistakes</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-caption leading-relaxed text-ink-muted">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineText text={item} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "remember":
      return (
        <div className="rounded-md border border-accent/30 bg-accent-wash px-5 py-4">
          <p className="font-mono text-micro tracking-widest text-accent uppercase">Never forget</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-caption leading-relaxed text-ink">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineText text={item} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "interview":
      return (
        <div className="rounded-md border border-line bg-surface-sunken px-5 py-4">
          <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            How this comes up in interviews
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-caption leading-relaxed text-ink-muted">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineText text={item} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "quiz":
      return <QuizBlock block={block} />;

    case "viz":
      return <VizBlock block={block} />;

    case "playground":
      return (
        <div className="flex flex-col gap-4">
          {/*
            The server-rendered copy: a reader with JS off, or a crawler, sees the real
            starter code and expected output here regardless of what the editor below
            does. The playground is layered on top of this, never a replacement for it
            (task 049).
          */}
          <figure className="flex flex-col gap-0 overflow-hidden rounded-md border border-line-strong">
            <figcaption className="border-b border-line-strong bg-surface-sunken px-4 py-2 text-caption text-ink-muted">
              Starter code · {block.language === "python" ? "Python" : "Java"}
            </figcaption>
            <div className="relative">
              <StaticCode code={block.starter} html={highlightedHtml} />
              <CopyCodeButton code={block.starter} />
            </div>
            {block.expectedOutput ? (
              <div className="border-t border-line-strong bg-surface-sunken px-4 py-3">
                <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Expected output</p>
                <pre className="mt-1 overflow-x-auto font-mono text-caption text-ink-muted">{block.expectedOutput}</pre>
              </div>
            ) : null}
          </figure>

          <PlaygroundLazy block={block} />
        </div>
      );
  }
}
