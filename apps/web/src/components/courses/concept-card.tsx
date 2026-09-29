import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";

type ConceptBlockData = Extract<Block, { kind: "concept" }>;

/**
 * A tinted definition/rule card (task 052) — a third tint alongside `analogy`'s blue wash
 * and `remember`'s accent border, so a reader can tell at a glance which kind of box this
 * is before reading a word of it. Uses `--accent-2` (green), already reserved by
 * `viz-tokens.ts` for "done"/success state, kept consistent here.
 */
export function ConceptCard({ block }: { block: ConceptBlockData }) {
  return (
    <aside
      className="rounded-md border px-5 py-4"
      style={{
        borderColor: "color-mix(in srgb, var(--accent-2) 35%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--accent-2) 7%, var(--surface-raised))",
      }}
    >
      <p className="font-mono text-micro tracking-widest uppercase" style={{ color: "var(--positive)" }}>
        Concept
      </p>
      <p className="mt-2 text-heading text-ink">
        <InlineText text={block.title} />
      </p>
      <p className="mt-2 text-body leading-relaxed text-ink">
        <InlineText text={block.text} />
      </p>
    </aside>
  );
}
