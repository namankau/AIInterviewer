import type { DesignCase } from "@untiered/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DESIGN_PHASES, DesignCasePanel, phaseAt } from "./design-workspace";

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

describe("DesignCasePanel", () => {
  it("shows the case and current round phase without exposing planned deep dives", () => {
    const designCase: DesignCase = {
      title: "Design an audit trail",
      summary: "Store immutable events for a multi-tenant service.",
      constraints: ["100M events per day"],
      openingPrompt: "How would you begin?",
      deepDiveOptions: ["Secret interviewer-only tradeoff"],
    };

    render(<DesignCasePanel designCase={designCase} minutesElapsed={15} durationMinutes={45} />);

    const panel = screen.getByRole("region", { name: "System design case" });
    expect(within(panel).getByRole("heading", { name: designCase.title })).toBeInTheDocument();
    expect(within(panel).getByText(designCase.summary)).toBeInTheDocument();
    expect(within(panel).getByText("100M events per day")).toBeInTheDocument();
    expect(within(panel).getByText("High-level")).toHaveAttribute("aria-current", "step");
    expect(within(panel).queryByText(designCase.deepDiveOptions[0]!)).not.toBeInTheDocument();
  });
});
