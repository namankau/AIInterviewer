import { describe, expect, it } from "vitest";

import { highlightChapterBlocks, highlightCode } from "@/lib/highlight-code";
import type { Block } from "@/content/courses/types";

/**
 * Shiki's grammars and themes ship inside the package itself — calling `codeToHtml` here
 * touches no network and no third-party API, so this exercises the real thing rather than
 * a mock (task 049 only bars live AI/model calls and Pyodide downloads).
 */
describe("highlightCode", () => {
  it("returns Shiki HTML carrying both light and dark token colours", async () => {
    const html = await highlightCode('System.out.println("hi");', "java");
    expect(html).not.toBeNull();
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("degrades to null, rather than throwing, for an unrecognised language", async () => {
    const html = await highlightCode("does not matter", "not-a-real-language");
    expect(html).toBeNull();
  });
});

describe("highlightChapterBlocks", () => {
  it("highlights code and playground blocks and leaves everything else null, aligned by index", async () => {
    const blocks: Block[] = [
      { kind: "p", text: "intro" },
      { kind: "code", code: "int x = 1;" },
      { kind: "playground", language: "python", starter: "print(1)" },
      { kind: "h", text: "heading" },
    ];

    const result = await highlightChapterBlocks(blocks);

    expect(result).toHaveLength(4);
    expect(result[0]).toBeNull();
    expect(result[1]).toContain("shiki");
    expect(result[2]).toContain("shiki");
    expect(result[3]).toBeNull();
  });
});
