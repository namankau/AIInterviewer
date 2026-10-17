import type { CodingProblem } from "@untiered/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DsaProblemPanel } from "./dsa-problem-panel";

describe("DsaProblemPanel", () => {
  it("keeps the full coding question readable in the question pane", () => {
    const problem: CodingProblem = {
      title: "Merge Overlapping Intervals",
      topic: "Interval merging",
      difficulty: "medium",
      statement: "Merge intervals that share any point.",
      examples: [{ input: "[[1,3],[2,6]]", output: "[[1,6]]" }],
      constraints: ["At most 100 intervals"],
      starterPython: "",
      starterJava: "",
      stdinFormat: "",
      testCases: [],
    };

    render(<DsaProblemPanel problem={problem} />);

    const panel = screen.getByRole("region", { name: "Coding problem" });
    expect(within(panel).getByRole("heading", { name: problem.title })).toBeInTheDocument();
    expect(within(panel).getByText(problem.statement)).toBeInTheDocument();
    expect(within(panel).getByText("[[1,3],[2,6]]")).toBeInTheDocument();
    expect(within(panel).getByText("At most 100 intervals", { exact: false })).toBeInTheDocument();
  });
});
