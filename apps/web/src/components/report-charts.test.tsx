import type { ReportCompetency } from "@acemyinterview/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompetencyBars, OverallScore, bandFor, overallScore } from "./report-charts";

const competency = (name: string, score: number, maxScore = 5): ReportCompetency => ({
  competency: name,
  score,
  maxScore,
  rationale: "Reached it, but only after the question was narrowed.",
  evidenceQuote: "I'd shard by user id so one wallet lands on one node.",
  turnIndex: 1,
});

describe("overallScore", () => {
  it("is the mean of the competency ratios", () => {
    expect(overallScore([competency("a", 2), competency("b", 3)])).toBe(50);
  });

  it("compares rubrics with different maxima", () => {
    expect(overallScore([competency("a", 2, 5), competency("b", 4, 10)])).toBe(40);
  });

  /**
   * Null rather than zero, and the distinction matters: a report with no scored
   * competencies has no overall score, and drawing 0% for it would be a claim about the
   * candidate rather than about the report.
   */
  it("has no score rather than a zero when nothing was scored", () => {
    expect(overallScore([])).toBeNull();
    expect(overallScore(undefined)).toBeNull();
    expect(overallScore([competency("broken", 3, 0)])).toBeNull();
  });
});

describe("bandFor", () => {
  /** The anchored scale the report prompt marks against. 40 is the default, not a fail. */
  it("names the band the way the marking scale does", () => {
    expect(bandFor(20).name).toBe("Under par");
    expect(bandFor(40).name).toBe("Ordinary");
    expect(bandFor(49.9).name).toBe("Ordinary");
    expect(bandFor(50).name).toBe("Good");
    expect(bandFor(60).name).toBe("Strong");
    expect(bandFor(70).name).toBe("Exceptional");
  });

  it("clamps rather than falling off either end", () => {
    expect(bandFor(-5).name).toBe("Under par");
    expect(bandFor(140).name).toBe(bandFor(100).name);
  });
});

/**
 * The reason this graphic exists. Scoring was recalibrated so that an ordinary round comes
 * out at 40%, and a candidate who has only ever seen a percentage on a school paper reads
 * 40% as a fail. Everything here is about the number never being announced — to the eye or
 * to a screen reader — without the word for what it means.
 */
describe("OverallScore", () => {
  it("never announces the number without the band it falls in", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    const meter = screen.getByRole("meter", { name: /overall score/i });
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/ordinary/i);
  });

  /** A screen-reader user must be told the scale is hard, not left to assume 40 is a fail. */
  it("tells a screen reader where the scale sits, not just where they sit", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    expect(screen.getByRole("meter", { name: /overall score/i }).getAttribute("aria-valuetext")).toMatch(
      /50% good/i,
    );
  });

  it("shows the band name beside the number", () => {
    render(<OverallScore competencies={[competency("a", 3)]} />);

    expect(screen.getByText(/^Strong$/)).toBeInTheDocument();
  });

  /** No score is not a score of nothing, so no instrument is drawn at all. */
  it("draws nothing when there is no score to draw", () => {
    render(<OverallScore competencies={[]} />);

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("CompetencyBars", () => {
  it("reports each competency's own score, not the overall one", () => {
    render(<CompetencyBars competencies={[competency("Scale estimation", 1), competency("Data modelling", 4)]} />);

    expect(screen.getByRole("meter", { name: "Scale estimation" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("meter", { name: "Data modelling" })).toHaveAttribute("aria-valuenow", "4");
  });

  it("carries the maximum, so a rubric out of ten is not read as out of five", () => {
    render(<CompetencyBars competencies={[competency("Depth", 4, 10)]} />);

    expect(screen.getByRole("meter", { name: "Depth" })).toHaveAttribute("aria-valuemax", "10");
  });

  /**
   * Reports are composed once and stored, so one written before this page existed comes
   * back without these keys. That exact shape has crashed the report before.
   */
  it("survives a stored report that predates competencies", () => {
    expect(() => render(<CompetencyBars competencies={undefined} />)).not.toThrow();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});
