import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ProgressPagePrototype,
  SYNTHETIC_PROGRESS_PROFILE,
} from "./progress-page-prototype";

describe("ProgressPagePrototype", () => {
  it("presents selected completion facts with links to first-party explanations", () => {
    const { container } = render(<ProgressPagePrototype />);

    expect(
      screen.getByRole("heading", { level: 1, name: SYNTHETIC_PROGRESS_PROFILE.displayName }),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic preview")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("28", { selector: "p" })).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "What the Java Programming course covers" }),
    ).toHaveAttribute("href", "/courses/java");
    expect(
      screen.getByRole("link", {
        name: "What the Data Structures & Algorithms course covers",
      }),
    ).toHaveAttribute("href", "/courses/dsa");

    const dates = container.querySelectorAll("time[datetime]");
    expect(dates).toHaveLength(5);
    expect(dates[0]).toHaveAttribute("datetime", "2026-09-28");
  });

  it("distinguishes completion from certification and lists the privacy boundary", () => {
    render(<ProgressPagePrototype />);

    expect(
      screen.getByText(/It is not a certification, a claim of skill mastery, or an employer endorsement/),
    ).toBeInTheDocument();

    const privacySection = screen.getByRole("heading", {
      name: "Evidence without private interview content",
    }).closest("section");
    expect(privacySection).not.toBeNull();

    const privacy = within(privacySection as HTMLElement);
    expect(privacy.getByText("Scores, rankings, and private feedback")).toBeInTheDocument();
    expect(privacy.getByText("Answers, transcripts, and recordings")).toBeInTheDocument();
    expect(privacy.getByText("Resume details and employer targets")).toBeInTheDocument();
  });

  it("does not imply the review artifact has publishing controls", () => {
    render(<ProgressPagePrototype />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/publish this page/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rotate link/i)).not.toBeInTheDocument();
  });
});
