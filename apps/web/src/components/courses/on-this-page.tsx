import { anchorId } from "@/content/courses/anchor";
import type { Block } from "@/content/courses/types";

/** Right-rail anchor list, built from a chapter's `h` blocks — wide screens only. */
export function OnThisPage({ blocks }: { blocks: Block[] }) {
  const headings = blocks.filter((b): b is Extract<Block, { kind: "h" }> => b.kind === "h");
  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="hidden xl:sticky xl:top-8 xl:block xl:self-start">
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">On this page</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {headings.map((h) => (
          <li key={h.text}>
            <a
              href={`#${anchorId(h.text)}`}
              className="block text-caption text-ink-muted transition-colors hover:text-ink"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
