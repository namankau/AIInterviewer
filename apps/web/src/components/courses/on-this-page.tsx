import { anchorId } from "@/content/courses/anchor";
import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";

/** Right-rail anchor list, built from a chapter's `h` blocks — wide screens only. */
export function OnThisPage({ blocks }: { blocks: Block[] }) {
  const headings = blocks.filter((b): b is Extract<Block, { kind: "h" }> => b.kind === "h");
  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page">
      <p className="text-micro font-bold tracking-widest text-accent-strong uppercase">On this page</p>
      <ol className="mt-4 flex flex-col gap-1.5">
        {headings.map((h) => (
          <li key={h.text}>
            <a
              href={`#${anchorId(h.text)}`}
              className="block border-l-2 border-line-strong py-1.5 pl-3 text-caption font-medium leading-snug text-ink-muted transition-colors hover:border-accent hover:text-accent-strong"
            >
              <InlineText text={h.text} />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
