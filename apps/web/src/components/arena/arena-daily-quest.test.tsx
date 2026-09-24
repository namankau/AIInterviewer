import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArenaDailyQuest } from "@/components/arena/arena-daily-quest";
import { localDateKey, type DailyCourseQuest } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

const capturedPanels = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("@/components/arena/arena-play-panel", () => ({
  ArenaPlayPanel: (props: Record<string, unknown>) => {
    capturedPanels.push(props);
    return <button type="button">{String(props.startLabel)}</button>;
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
  it("labels each course and its topics, and starts fixed rather than personalized sets", () => {
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
    expect(capturedPanels).toHaveLength(4);
    expect(capturedPanels.every((props) => props.selectionMode === "fixed")).toBe(true);
    expect(capturedPanels.map((props) => props.courseSlug)).toEqual(["java", "dsa", "ai-agents", "system-design"]);
  });
});
