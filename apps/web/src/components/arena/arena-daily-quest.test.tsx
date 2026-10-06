import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { localDateKey, type DailyCourseQuest } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

const capturedPanels = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/arena/arena-play-panel", () => ({
  ArenaPlayPanel: (props: Record<string, unknown>) => {
    capturedPanels.push(props);
    return <div data-testid="arena-play-panel">{String(props.startLabel)}</div>;
  },
}));

function challenge(courseSlug: string, moduleTitle: string, id: string): Challenge {
  return {
    id,
    kind: "mcq",
    courseSlug,
    chapterSlug: "chapter",
    moduleTitle,
    prompt: "Question?",
    options: ["Yes", "No"],
    correctIndex: 0,
    why: "Because.",
  };
}

describe("ArenaDailyQuest", () => {
  it("shows aligned course choices, then opens one fixed set in a dedicated workspace", async () => {
    capturedPanels.length = 0;
    const today = localDateKey(new Date());
    const quests: DailyCourseQuest[] = [
      {
        courseSlug: "java",
        courseTitle: "Java Programming",
        challenges: [challenge("java", "Arrays", "java-1"), challenge("java", "Methods", "java-2")],
      },
      {
        courseSlug: "dsa",
        courseTitle: "Data Structures & Algorithms",
        challenges: [challenge("dsa", "Searching", "dsa-1")],
      },
      {
        courseSlug: "ai-agents",
        courseTitle: "AI and Agentic AI",
        challenges: [challenge("ai-agents", "Tool use", "ai-1")],
      },
      {
        courseSlug: "system-design",
        courseTitle: "System Design",
        challenges: [challenge("system-design", "Architecture", "system-design-1")],
      },
    ];

    render(<ArenaDailyQuest questsByDate={{ [today]: quests }} />);

    expect(screen.getByRole("heading", { name: "Java Programming" })).toBeInTheDocument();
    expect(screen.getByText("2 questions · Arrays · Methods")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data Structures & Algorithms" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI and Agentic AI" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System Design" })).toBeInTheDocument();
    expect(capturedPanels).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Play Java Programming set" }));

    expect(screen.getByRole("heading", { name: "Java Programming" })).toBeInTheDocument();
    expect(screen.getByTestId("arena-play-panel")).toBeInTheDocument();
    expect(capturedPanels).toHaveLength(1);
    expect(capturedPanels[0]).toEqual(
      expect.objectContaining({
        courseSlug: "java",
        initiallyPlaying: true,
        selectionMode: "fixed",
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: /choose another set/i }));

    expect(screen.queryByTestId("arena-play-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play System Design set" })).toBeInTheDocument();
  });
});
