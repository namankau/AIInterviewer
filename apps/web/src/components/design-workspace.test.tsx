import { describe, expect, it } from "vitest";

import { DESIGN_PHASES, phaseAt } from "./design-workspace";

/**
 * The rail's only job is pacing: it tells a candidate roughly where a real interviewer
 * would be by now. It is advisory on purpose — a candidate still arguing about
 * requirements at the half hour is telling the interviewer something worth knowing, and
 * a UI that forced them on would erase that signal rather than record it.
 */
describe("phaseAt", () => {
  it("walks a full-length round through every phase in order", () => {
    const walked = [0, 12, 25, 40].map((minute) => phaseAt(minute, 45));

    expect(walked).toEqual(["Requirements", "High-level", "Deep dive", "Wrap"]);
  });

  /** The five-minute test round has to be a miniature of a real one, not a stub. */
  it("gives a five-minute round the same shape", () => {
    expect(phaseAt(0, 5)).toBe("Requirements");
    expect(phaseAt(2, 5)).toBe("High-level");
    expect(phaseAt(3, 5)).toBe("Deep dive");
    expect(phaseAt(5, 5)).toBe("Wrap");
  });

  it("opens in requirements before the clock has started", () => {
    expect(phaseAt(0, 45)).toBe("Requirements");
  });

  /** Overrunning is a real thing candidates do. It must not fall off the end. */
  it("stays in the wrap-up when the round has overrun", () => {
    expect(phaseAt(90, 45)).toBe("Wrap");
    expect(DESIGN_PHASES).toContain(phaseAt(90, 45));
  });

  it("survives a round with no length rather than dividing by zero", () => {
    expect(phaseAt(10, 0)).toBe("Requirements");
  });
});
