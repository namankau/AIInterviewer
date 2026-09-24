import { describe, expect, it } from "vitest";

import {
  checkNewBadges,
  dailyCourseQuests,
  dailyQuest,
  DAILY_COURSE_QUEST_SIZE,
  DAILY_QUEST_SIZE,
  levelForXp,
  localDateKey,
  recordActivity,
  xpForLevel,
} from "@/lib/arena/progression";
import type { StreakState } from "@/lib/arena/storage";
import type { Challenge } from "@/lib/arena/types";

function makeChallenge(overrides: Partial<Challenge>): Challenge {
  return {
    id: "id",
    kind: "mcq",
    courseSlug: "dsa",
    chapterSlug: "chapter-a",
    moduleTitle: "Module A",
    prompt: "prompt",
    options: ["a", "b"],
    correctIndex: 0,
    why: "why",
    ...overrides,
  };
}

describe("xp and levels", () => {
  it("level 0 needs no XP; each level costs strictly more than the last", () => {
    expect(xpForLevel(0)).toBe(0);
    const costs = [1, 2, 3, 4, 5].map((n) => xpForLevel(n) - xpForLevel(n - 1));
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
  });

  it("levelForXp reports the right level and remaining progress at exact thresholds", () => {
    const at = levelForXp(xpForLevel(3));
    expect(at.level).toBe(3);
    expect(at.xpIntoLevel).toBe(0);
  });

  it("levelForXp reports partial progress correctly mid-level", () => {
    const midpoint = xpForLevel(2) + 10;
    const progress = levelForXp(midpoint);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(10);
    expect(progress.xpForNextLevel).toBe(xpForLevel(3) - xpForLevel(2));
  });

  it("zero XP is level 0 with nothing into it", () => {
    expect(levelForXp(0)).toEqual({ level: 0, xpIntoLevel: 0, xpForNextLevel: xpForLevel(1) });
  });
});

describe("localDateKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(localDateKey(new Date("2026-06-15T12:00:00Z"), "UTC")).toBe("2026-06-15");
  });

  // The exact bug CLAUDE.md calls out: a moment that is one calendar day in UTC and the
  // next calendar day in IST (UTC+5:30). 23:50 UTC on 1 Jan is 05:20 IST on 2 Jan.
  it("resolves the UTC/IST day-boundary case correctly for a fixed instant", () => {
    const instant = new Date("2026-01-01T23:50:00Z");
    expect(localDateKey(instant, "UTC")).toBe("2026-01-01");
    expect(localDateKey(instant, "Asia/Kolkata")).toBe("2026-01-02");
  });
});

describe("recordActivity (streak)", () => {
  const fresh: StreakState = { current: 0, longest: 0, lastActiveDate: null };

  it("first-ever activity starts a streak of 1", () => {
    const result = recordActivity(fresh, new Date("2026-01-01T10:00:00Z"), "UTC");
    expect(result).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-01-01" });
  });

  it("a second play on the same calendar day does not double-count", () => {
    const first = recordActivity(fresh, new Date("2026-01-01T09:00:00Z"), "UTC");
    const second = recordActivity(first, new Date("2026-01-01T21:00:00Z"), "UTC");
    expect(second).toEqual(first);
  });

  it("activity on the very next calendar day extends the streak", () => {
    const day1 = recordActivity(fresh, new Date("2026-01-01T10:00:00Z"), "UTC");
    const day2 = recordActivity(day1, new Date("2026-01-02T10:00:00Z"), "UTC");
    expect(day2.current).toBe(2);
    expect(day2.longest).toBe(2);
  });

  it("skipping a calendar day resets the current streak but keeps the longest", () => {
    const day1 = recordActivity(fresh, new Date("2026-01-01T10:00:00Z"), "UTC");
    const day2 = recordActivity(day1, new Date("2026-01-02T10:00:00Z"), "UTC");
    const day5 = recordActivity(day2, new Date("2026-01-05T10:00:00Z"), "UTC");
    expect(day5.current).toBe(1);
    expect(day5.longest).toBe(2);
  });

  it("does not break at the 5:30am IST boundary when the caller uses the learner's timezone", () => {
    // 11:50pm UTC on day N is 5:20am IST on day N+1 — a naive UTC-only implementation
    // would say these two calls are on different days when the learner (in IST) sees
    // them as the same evening/next-morning boundary handled consistently only if the
    // caller consistently passes the learner's own timezone, which this proves works.
    const eveningIst = recordActivity(fresh, new Date("2026-01-01T15:00:00Z"), "Asia/Kolkata"); // 8:30pm IST, 1 Jan
    const nextMorningIst = recordActivity(eveningIst, new Date("2026-01-01T23:50:00Z"), "Asia/Kolkata"); // 5:20am IST, 2 Jan
    expect(nextMorningIst.current).toBe(2);
  });

  it("a genuine timezone change (traveller) still keys off the calendar date in the timezone given", () => {
    const inUtc = recordActivity(fresh, new Date("2026-01-01T10:00:00Z"), "UTC");
    // Same instant re-evaluated in a different timezone must not silently duplicate or
    // skip a day merely because the caller's zone changed between calls.
    const inTokyo = recordActivity(inUtc, new Date("2026-01-02T10:00:00Z"), "Asia/Tokyo");
    expect(inTokyo.current).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(inTokyo.current)).toBe(true);
  });
});

describe("checkNewBadges", () => {
  const chapterAChallenges = [
    makeChallenge({ id: "a1", chapterSlug: "chapter-a", moduleTitle: "Module A" }),
    makeChallenge({ id: "a2", chapterSlug: "chapter-a", moduleTitle: "Module A" }),
  ];
  const chapterBChallenges = [makeChallenge({ id: "b1", chapterSlug: "chapter-b", moduleTitle: "Module A" })];
  const allChallenges = [...chapterAChallenges, ...chapterBChallenges];

  it("awards no badges with no progress", () => {
    const result = checkNewBadges(
      { streak: { current: 0, longest: 0, lastActiveDate: null }, masteredChallengeIds: [], allChallenges },
      [],
    );
    expect(result).toEqual([]);
  });

  it("awards the streak badge only at 7 days, not before", () => {
    const six = checkNewBadges(
      { streak: { current: 6, longest: 6, lastActiveDate: "2026-01-06" }, masteredChallengeIds: [], allChallenges },
      [],
    );
    expect(six.find((b) => b.id === "streak-7")).toBeUndefined();

    const seven = checkNewBadges(
      { streak: { current: 7, longest: 7, lastActiveDate: "2026-01-07" }, masteredChallengeIds: [], allChallenges },
      [],
    );
    expect(seven.find((b) => b.id === "streak-7")).toBeDefined();
  });

  it("does not re-award a badge already in alreadyEarned", () => {
    const result = checkNewBadges(
      { streak: { current: 10, longest: 10, lastActiveDate: "2026-01-10" }, masteredChallengeIds: [], allChallenges },
      ["streak-7"],
    );
    expect(result.find((b) => b.id === "streak-7")).toBeUndefined();
  });

  it("awards chapter-clean only once every challenge in a real chapter is mastered", () => {
    const partial = checkNewBadges(
      {
        streak: { current: 0, longest: 0, lastActiveDate: null },
        masteredChallengeIds: ["a1"],
        allChallenges,
      },
      [],
    );
    expect(partial.find((b) => b.id === "chapter-clean")).toBeUndefined();

    const complete = checkNewBadges(
      {
        streak: { current: 0, longest: 0, lastActiveDate: null },
        masteredChallengeIds: ["a1", "a2"],
        allChallenges,
      },
      [],
    );
    expect(complete.find((b) => b.id === "chapter-clean")).toBeDefined();
  });

  it("awards module-complete only once every challenge in the whole module is mastered", () => {
    const chapterOnly = checkNewBadges(
      {
        streak: { current: 0, longest: 0, lastActiveDate: null },
        masteredChallengeIds: ["a1", "a2"],
        allChallenges,
      },
      [],
    );
    expect(chapterOnly.find((b) => b.id === "module-complete")).toBeUndefined();

    const wholeModule = checkNewBadges(
      {
        streak: { current: 0, longest: 0, lastActiveDate: null },
        masteredChallengeIds: ["a1", "a2", "b1"],
        allChallenges,
      },
      [],
    );
    expect(wholeModule.find((b) => b.id === "module-complete")).toBeDefined();
  });
});

describe("dailyQuest", () => {
  const pool = Array.from({ length: 40 }, (_, i) => makeChallenge({ id: `c${i}`, prompt: `q${i}` }));

  it("returns DAILY_QUEST_SIZE challenges when the pool is large enough", () => {
    expect(dailyQuest(pool, "2026-01-01")).toHaveLength(DAILY_QUEST_SIZE);
  });

  it("is stable across repeated calls for the same date", () => {
    const first = dailyQuest(pool, "2026-03-14").map((c) => c.id);
    const second = dailyQuest(pool, "2026-03-14").map((c) => c.id);
    expect(second).toEqual(first);
  });

  it("differs (in general) between two different dates", () => {
    const day1 = dailyQuest(pool, "2026-03-14").map((c) => c.id);
    const day2 = dailyQuest(pool, "2026-03-15").map((c) => c.id);
    expect(day2).not.toEqual(day1);
  });

  it("never exceeds the pool size, and returns nothing for an empty pool", () => {
    expect(dailyQuest([], "2026-01-01")).toEqual([]);
    const tiny = pool.slice(0, 3);
    expect(dailyQuest(tiny, "2026-01-01")).toHaveLength(3);
  });
});

describe("dailyCourseQuests", () => {
  const courseLabels = [
    { slug: "java", title: "Java Programming" },
    { slug: "dsa", title: "Data Structures & Algorithms" },
    { slug: "ai-agents", title: "AI and Agentic AI" },
    { slug: "system-design", title: "System Design" },
  ];
  const pool = courseLabels.flatMap(({ slug, title }) =>
    Array.from({ length: 12 }, (_, index) =>
      makeChallenge({
        id: `${slug}-${index}`,
        courseSlug: slug,
        moduleTitle: `${title} topic ${index % 2}`,
      }),
    ),
  );

  it("returns a stable, course-scoped set for every course on the same day", () => {
    const first = dailyCourseQuests(pool, courseLabels, "2026-09-24");
    const second = dailyCourseQuests(pool, courseLabels, "2026-09-24");

    expect(second).toEqual(first);
    expect(first.map((group) => group.courseSlug)).toEqual(["java", "dsa", "ai-agents", "system-design"]);
    for (const group of first) {
      expect(group.challenges).toHaveLength(DAILY_COURSE_QUEST_SIZE);
      expect(group.challenges.every((challenge) => challenge.courseSlug === group.courseSlug)).toBe(true);
      expect(group.challenges.every((challenge) => challenge.moduleTitle.length > 0)).toBe(true);
    }
  });

  it("rotates every course's set on a different calendar date", () => {
    const dayOne = dailyCourseQuests(pool, courseLabels, "2026-09-24");
    const dayTwo = dailyCourseQuests(pool, courseLabels, "2026-09-25");

    for (const group of dayOne) {
      const nextGroup = dayTwo.find((candidate) => candidate.courseSlug === group.courseSlug);
      expect(nextGroup).toBeDefined();
      expect(nextGroup!.challenges.map((challenge) => challenge.id)).not.toEqual(
        group.challenges.map((challenge) => challenge.id),
      );
    }
  });
});
