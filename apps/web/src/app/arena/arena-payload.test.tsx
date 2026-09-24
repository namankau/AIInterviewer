import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArenaCoursePage from "@/app/arena/[course]/page";
import ArenaPage from "@/app/arena/page";
import { courses } from "@/content/courses";
import { DAILY_COURSE_QUEST_SIZE, type DailyCourseQuest } from "@/lib/arena/progression";

/**
 * Guards L3 of task 056: `/arena` used to pass the entire ~800-challenge corpus into a
 * client component so the daily quest could be picked; `/arena/[course]` did the same so a
 * practice run could be picked. Both crossed the RSC boundary as serialized props, which is
 * exactly what bloated `arena.html`/`arena.rsc` to 892 KB / 820 KB. This test asserts an
 * upper bound on how many challenges either page now hands to the client, so a future
 * change can't casually widen that boundary back open.
 */

const capturedDailyQuestProps = vi.hoisted(() => ({
  current: null as { questsByDate: Record<string, DailyCourseQuest[]> } | null,
}));
vi.mock("@/components/arena/arena-daily-quest", () => ({
  ArenaDailyQuest: (props: { questsByDate: Record<string, DailyCourseQuest[]> }) => {
    capturedDailyQuestProps.current = props;
    return null;
  },
}));
vi.mock("@/components/arena/progress-summary", () => ({ ProgressSummary: () => null }));
vi.mock("@/components/arena/import-browser-arena", () => ({ ImportBrowserArenaProgress: () => null }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/courses/course-site-header", () => ({
  CourseSiteHeader: () => null,
  CourseSiteFooter: () => null,
}));
vi.mock("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));

const capturedCoursePracticeProps = vi.hoisted(
  () => ({ current: null as { courseSlug: string; chapters: unknown[]; allCourseChallenges?: unknown } | null }),
);
vi.mock("@/components/arena/arena-course-practice", () => ({
  ArenaCoursePractice: (props: { courseSlug: string; chapters: unknown[]; allCourseChallenges?: unknown }) => {
    capturedCoursePracticeProps.current = props;
    return null;
  },
}));

describe("/arena — daily quest payload", () => {
  it("hands the client at most one daily quest's worth of challenges per possible date, never the whole corpus", async () => {
    render(<ArenaPage />);

    const props = capturedDailyQuestProps.current;
    expect(props).not.toBeNull();

    const dateKeys = Object.keys(props!.questsByDate);
    // possibleDateKeysWorldwide can return at most 3 dates (UTC-12..UTC+14 spans at most 3
    // calendar days).
    expect(dateKeys.length).toBeGreaterThan(0);
    expect(dateKeys.length).toBeLessThanOrEqual(3);

    const totalChallenges = Object.values(props!.questsByDate).reduce(
      (sum, quests) => sum + quests.reduce((dateSum, quest) => dateSum + quest.challenges.length, 0),
      0,
    );
    expect(totalChallenges).toBeLessThanOrEqual(3 * courses.length * DAILY_COURSE_QUEST_SIZE);
  });
});

describe("/arena/[course] — practice set payload", () => {
  it("no longer passes the course's challenge corpus down as a prop — the client fetches it itself", async () => {
    const params = Promise.resolve({ course: "dsa" });
    const element = await ArenaCoursePage({ params });
    render(element);

    const props = capturedCoursePracticeProps.current;
    expect(props).not.toBeNull();
    expect(props!.allCourseChallenges).toBeUndefined();
    // `chapters` stays — it's just slugs and titles, nowhere near the corpus's size.
    expect(Array.isArray(props!.chapters)).toBe(true);
  });
});
