import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";

type StepsBlockData = Extract<Block, { kind: "steps" }>;

/** A plain SVG chevron, drawn rather than an emoji arrow, purely decorative between two
 * labelled stages (the sequence is carried by the numbering, not the arrow). */
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M6 4l6 6-6 6" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A numbered, coloured pipeline strip for anything sequential — compile → bytecode → JVM,
 * or choose → recurse → undo (task 052) — instead of a numbered prose list. The whole
 * strip scrolls horizontally on narrow screens (same pattern as a code block) rather than
 * wrapping awkwardly or forcing the page itself to scroll sideways.
 */
export function StepsBlock({ block }: { block: StepsBlockData }) {
  return (
    <figure className="rounded-md border border-line-strong bg-surface-raised p-4">
      {block.title ? (
        <figcaption className="mb-3 text-caption font-medium text-ink">
          <InlineText text={block.title} />
        </figcaption>
      ) : null}
      <ol className="flex max-w-full list-none items-stretch gap-0 overflow-x-auto pb-1">
        {block.steps.map((step, i) => (
          <li key={i} className="flex shrink-0 items-stretch">
            <div className="flex w-56 flex-col gap-1.5 rounded-md border border-line bg-surface-sunken px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-micro font-semibold text-accent-contrast">
                  {i + 1}
                </span>
                <span className="text-caption font-semibold text-ink">
                  <InlineText text={step.label} />
                </span>
              </div>
              <p className="text-body leading-relaxed text-ink">
                <InlineText text={step.text} />
              </p>
            </div>
            {i < block.steps.length - 1 ? (
              <div className="flex w-8 shrink-0 items-center justify-center text-ink-subtle" aria-hidden="true">
                <ArrowIcon />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
