import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChallengeCard } from "./challenge-card";

describe("ChallengeCard", () => {
  it("shows the scenario context before a derived classification question", () => {
    render(
      <ChallengeCard
        challenge={{
          id: "which-column-system-design-requirements",
          kind: "which-column",
          courseSlug: "system-design",
          chapterSlug: "requirements-first",
          moduleTitle: "Foundations: frame the problem",
          context:
            "From “Start With Requirements, Not Boxes”: classify this example: “Prevents double booking”",
          prompt: "Which category does this example belong to?",
          options: ["What users do", "How well it works"],
          correctIndex: 1,
          why: "This is a quality requirement.",
        }}
        selected={null}
        submitted={false}
        wasCorrect={null}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText(/prevents double booking/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: /which category does this example belong to/i })).toBeVisible();
  });
});
