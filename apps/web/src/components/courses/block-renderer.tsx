import { anchorId } from "@/content/courses/anchor";
import type { Block } from "@/content/courses/types";
import { QuizBlock } from "@/components/courses/quiz-block";
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
 */
export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-8">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
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
      return (
        <figure className="flex flex-col gap-0 overflow-hidden rounded-md border border-line-strong">
          {block.caption ? (
            <figcaption className="border-b border-line-strong bg-surface-sunken px-4 py-2 text-caption text-ink-muted">
              {block.caption}
            </figcaption>
          ) : null}
          <div className="relative">
            <pre className="overflow-x-auto bg-surface-raised px-4 py-4 font-mono text-caption text-ink">
              <code>{block.code}</code>
            </pre>
            <CopyCodeButton code={block.code} />
          </div>
          {block.output ? (
            <div className="border-t border-line-strong bg-surface-sunken px-4 py-3">
              <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Output</p>
              <pre className="mt-1 overflow-x-auto font-mono text-caption text-ink-muted">{block.output}</pre>
            </div>
          ) : null}
        </figure>
      );

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
  }
}
