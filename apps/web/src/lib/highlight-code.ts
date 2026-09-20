import { codeToHtml } from "shiki";

import type { Block } from "@/content/courses/types";

/**
 * Server/build-time syntax highlighting for static course code (task 049).
 *
 * Deliberately **not** a client component: `codeToHtml` runs once, on the server, while a
 * chapter page is being generated, and its output is plain HTML with inline `--shiki-*`
 * colour variables — no highlighter, grammar, or theme ships to the browser. The one thing
 * every call must survive is an unfamiliar language string; a bad chapter or a Shiki
 * version bump should degrade to plain, unhighlighted code, never break the build or the
 * page (`BlockRenderer` falls back to a plain `<pre>` when this returns `null`).
 *
 * Both themes are baked into every call — light and dark — because the product has no
 * class-based theme switch: `globals.css` reacts to `prefers-color-scheme` alone, and the
 * generated HTML needs to do the same (see the `.shiki` rules there).
 */
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  try {
    return await codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
  } catch {
    return null;
  }
}

/**
 * Highlights every `code` and `playground` block in a chapter, aligned with `blocks` by
 * index (other kinds get `null`). Called once per chapter render — `codeToHtml` caches its
 * own highlighter internally, so this stays cheap across the handful of calls a chapter
 * makes.
 */
export function highlightChapterBlocks(blocks: Block[]): Promise<Array<string | null>> {
  return Promise.all(
    blocks.map((block) => {
      if (block.kind === "code") return highlightCode(block.code, "java");
      if (block.kind === "playground") return highlightCode(block.starter, block.language);
      return Promise.resolve(null);
    }),
  );
}
