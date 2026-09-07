import { describe, expect, it } from "vitest";

import { revealedText } from "@/lib/spoken-text";

const QUESTION = "Walk me through how that settlement pipeline actually works.";

describe("revealedText", () => {
  /**
   * Not "nothing": the reveal deliberately runs a fraction ahead of the voice, so the
   * first word or two is already up as the interviewer starts speaking. What must not
   * happen is the whole question landing before a word of it is said, which is the
   * behaviour this replaces.
   */
  it("shows at most an opening word as the voice starts", () => {
    const atStart = revealedText(QUESTION, 0, 6);

    expect(atStart.length).toBeLessThan(QUESTION.length / 4);
    expect(QUESTION.startsWith(atStart)).toBe(true);
  });

  it("has revealed the whole question by the time the voice finishes", () => {
    expect(revealedText(QUESTION, 6, 6)).toBe(QUESTION);
  });

  it("reveals more as the voice goes on", () => {
    const early = revealedText(QUESTION, 1.5, 6).length;
    const later = revealedText(QUESTION, 4, 6).length;

    expect(later).toBeGreaterThan(early);
    expect(early).toBeGreaterThan(0);
  });

  it("only ever reveals a prefix of the question", () => {
    const partial = revealedText(QUESTION, 2.5, 6);

    expect(QUESTION.startsWith(partial)).toBe(true);
  });

  /**
   * The failure that matters. If the audio element cannot say how long it is, holding
   * the text back would leave the candidate staring at an empty room — strictly worse
   * than the out-of-sync reveal this replaces.
   */
  it("falls back to the whole question when the audio cannot be timed", () => {
    expect(revealedText(QUESTION, 0, 0)).toBe(QUESTION);
    expect(revealedText(QUESTION, 0, Number.NaN)).toBe(QUESTION);
    expect(revealedText(QUESTION, 0, Number.POSITIVE_INFINITY)).toBe(QUESTION);
  });

  it("runs slightly ahead of the voice rather than behind it", () => {
    // A reader fractionally in front of the speaker reads as natural; one that lags
    // reads as broken.
    const halfway = revealedText(QUESTION, 3, 6);
    const words = QUESTION.split(/\s+/).length;
    const revealed = halfway.trim().split(/\s+/).length;

    expect(revealed).toBeGreaterThanOrEqual(Math.floor(words / 2));
  });

  it("does not break on an empty question", () => {
    expect(revealedText("", 1, 6)).toBe("");
  });
});
