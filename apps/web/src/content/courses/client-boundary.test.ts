import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards L2 of task 056: a client component that imports `{ courses }` (or anything else)
 * from the course content barrel pulls in every chapter's code samples, `viz` frames and
 * quizzes — 744 KB of it, shipped to every visitor of whatever route renders it, whether or
 * not it's used. `continue-learning.tsx` did exactly this until it was switched to taking a
 * slim `CourseOutline[]` prop derived server-side (`@/lib/course-outline`). This test fails
 * if that regression walks back in, here or anywhere else.
 *
 * Importing `@/content/courses/types` (type-only, erased at build time) is fine. Importing
 * a specific chapter file directly is unusual but out of scope for this guard — the barrel
 * (`@/content/courses`, i.e. `content/courses/index.ts`) is what carries every course's full
 * content at once, so that's the import this test forbids from a client file.
 */

const SRC_DIR = path.resolve(__dirname, "..", "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const BARREL_IMPORT = /from\s+["']@\/content\/courses["']/;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isClientFile(source: string): boolean {
  const firstStatement = source
    .split("\n")
    .find((line) => line.trim().length > 0 && !line.trim().startsWith("//"));
  return firstStatement !== undefined && /^["']use client["'];?$/.test(firstStatement.trim());
}

describe("client components never import the course content barrel", () => {
  it("no \"use client\" file imports from @/content/courses (only @/content/courses/types)", () => {
    const offenders = collectSourceFiles(SRC_DIR)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return isClientFile(source) && BARREL_IMPORT.test(source);
      })
      .map((file) => path.relative(SRC_DIR, file));

    expect(offenders).toEqual([]);
  });
});
