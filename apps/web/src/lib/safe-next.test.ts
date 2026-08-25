import { describe, expect, it } from "vitest";

import { DEFAULT_SIGNED_IN_PATH, safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps an internal path", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/dashboard?tab=history")).toBe("/dashboard?tab=history");
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeNext("https://evil.example/steal")).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeNext("//evil.example/steal")).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("rejects a backslash-escaped path some browsers normalise to an origin", () => {
    expect(safeNext("/\\evil.example")).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it("falls back when the parameter is absent", () => {
    expect(safeNext(null)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeNext(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
  });
});
