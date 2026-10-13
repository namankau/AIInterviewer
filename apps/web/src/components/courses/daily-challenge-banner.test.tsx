import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DailyChallengeBanner } from "@/components/courses/daily-challenge-banner";
import { localDateKey } from "@/lib/arena/progression";

describe("DailyChallengeBanner", () => {
  it("shows today's actual question and opens its focused route", () => {
    render(<DailyChallengeBanner levelsByCourse={{ dsa: "Beginner" }} questionsByDate={{
      [localDateKey(new Date())]: {
        id: "q1", kind: "mcq", courseSlug: "dsa", chapterSlug: "arrays", moduleTitle: "Arrays", chapterTitle: "Array basics",
        prompt: "Which index is first?", options: ["Zero", "One"], correctIndex: 0, why: "Arrays start at zero.",
      },
    }} />);
    expect(screen.getByRole("heading", { name: "Which index is first?" })).toBeInTheDocument();
    expect(screen.getByText("From Array basics")).toBeInTheDocument();
    expect(screen.getByText("Beginner path")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solve today's question/i })).toHaveAttribute("href", "/daily-challenge");
  });
});
