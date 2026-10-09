import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";

type StepsBlockData = Extract<Block, { kind: "steps" }>;

/**
 * A numbered pipeline for anything sequential — compile → bytecode → JVM, or choose →
 * recurse → undo. Cards use the available row width instead of a fixed 14rem column: long
 * system-design examples should wrap as readable paragraphs, not as tall ribbons beside
 * unused space. On small screens they stack in reading order.
 */
export function StepsBlock({ block }: { block: StepsBlockData }) {
  return (
    <figure className="rounded-md border border-line-strong bg-surface-raised p-4">
      {block.title ? (
        <figcaption className="mb-3 text-caption font-medium text-ink">
          <InlineText text={block.title} />
        </figcaption>
      ) : null}
      <ol className="grid list-none gap-3 md:grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
        {block.steps.map((step, i) => (
          <li key={i} className="flex min-w-0 items-stretch">
            <div className="flex w-full flex-col gap-2 rounded-md border border-line bg-surface-sunken px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-micro font-semibold text-accent-contrast">
                  {i + 1}
                </span>
                <span className="block text-caption font-semibold text-ink first-letter:uppercase">
                  <InlineText text={step.label} />
                </span>
              </div>
              <p className="text-body leading-relaxed text-ink">
                <InlineText text={step.text} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
