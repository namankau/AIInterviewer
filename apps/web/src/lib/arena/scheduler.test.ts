import { describe, expect, it } from "vitest";

import { isDue, newReviewState, scheduleNext } from "@/lib/arena/scheduler";

describe("scheduler", () => {
  it("a brand-new card is due immediately", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const state = newReviewState(now);
    expect(isDue(state, now)).toBe(true);
  });

  it("an unseen challenge (no stored state at all) is due", () => {
    expect(isDue(undefined)).toBe(true);
  });

  it("answering correctly pushes the due date into the future", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const next = scheduleNext(undefined, true, now);
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime());
    expect(isDue(next, now)).toBe(false);
  });

  it("a correct-then-correct card is scheduled further out than a single correct answer", () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const afterOne = scheduleNext(undefined, true, t0);
    const t1 = new Date(afterOne.due);
    const afterTwo = scheduleNext(afterOne, true, t1);
    const gapAfterOne = new Date(afterOne.due).getTime() - t0.getTime();
    const gapAfterTwo = new Date(afterTwo.due).getTime() - t1.getTime();
    expect(gapAfterTwo).toBeGreaterThanOrEqual(gapAfterOne);
  });

  it("answering incorrectly brings the card back sooner than answering correctly would", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const learned = scheduleNext(undefined, true, now); // get past the "New" state
    const midpoint = new Date(learned.due);

    const afterWrong = scheduleNext(learned, false, midpoint);
    const afterRight = scheduleNext(learned, true, midpoint);

    const wrongGap = new Date(afterWrong.due).getTime() - midpoint.getTime();
    const rightGap = new Date(afterRight.due).getTime() - midpoint.getTime();
    expect(wrongGap).toBeLessThanOrEqual(rightGap);
  });

  it("a wrong answer increments lapses; a right answer never does", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const learned = scheduleNext(undefined, true, now);
    const wrong = scheduleNext(learned, false, new Date(learned.due));
    expect(wrong.lapses).toBeGreaterThanOrEqual(learned.lapses);

    const right = scheduleNext(learned, true, new Date(learned.due));
    expect(right.lapses).toBe(learned.lapses);
  });

  it("reps increases by exactly one on every review, right or wrong", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const s1 = scheduleNext(undefined, true, now);
    expect(s1.reps).toBe(1);
    const s2 = scheduleNext(s1, false, new Date(s1.due));
    expect(s2.reps).toBe(2);
  });

  it("round-trips through JSON with no loss (this is what localStorage will actually store)", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const state = scheduleNext(undefined, true, now);
    const roundTripped = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
    // and it must still be usable after the round trip
    const again = scheduleNext(roundTripped, true, new Date(state.due));
    expect(new Date(again.due).getTime()).toBeGreaterThan(new Date(state.due).getTime());
  });
});
