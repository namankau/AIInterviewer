import { describe, expect, it } from "vitest";

import { matchesExpected } from "./browser-python";

/**
 * What counts as the right answer.
 *
 * The starter programs print one line and the test case says what that line should be, so
 * the comparison is exact — except for the whitespace a `print` adds and a candidate
 * cannot see. Being strict about a trailing newline would fail a correct solution and
 * send someone hunting for a bug that is not in their code, which is the worst thing this
 * function could do during an interview.
 */
describe("matchesExpected", () => {
  it("ignores the trailing newline a print adds", () => {
    expect(matchesExpected("true\n", "true")).toBe(true);
    expect(matchesExpected("42\n\n", "42")).toBe(true);
  });

  it("ignores whitespace around the expected value too", () => {
    expect(matchesExpected("[1, 2]", "  [1, 2]  ")).toBe(true);
  });

  it("still holds the answer to the letter", () => {
    expect(matchesExpected("True", "true")).toBe(false);
    expect(matchesExpected("[1,2]", "[1, 2]")).toBe(false);
    expect(matchesExpected("", "0")).toBe(false);
  });

  /** A program that printed nothing has not passed an empty expectation by accident. */
  it("treats no output as no output", () => {
    expect(matchesExpected("", "")).toBe(true);
    expect(matchesExpected("\n", "")).toBe(true);
  });
});
