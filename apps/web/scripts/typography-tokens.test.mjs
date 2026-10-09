import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const sourceRoot = join(process.cwd(), "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const banned = [
  /\btext-\[[^\]]+\]/,
  /\btracking-\[[^\]]+\]/,
  /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/,
  /\bfont-serif\b/,
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    return sourceExtensions.has(extension) ? [path] : [];
  });
}

test("production UI uses the shared typography scale", () => {
  const violations = [];
  for (const path of sourceFiles(sourceRoot)) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (banned.some((pattern) => pattern.test(line))) {
        violations.push(`${relative(process.cwd(), path)}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    violations,
    [],
    `Use text-hero/display/title/heading/body/caption/micro and tracking-widest instead:\n${violations.join("\n")}`,
  );
});
