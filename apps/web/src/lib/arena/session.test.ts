import { describe, expect, it } from "vitest";

import { newReviewState, scheduleNext, type ReviewState } from "@/lib/arena/scheduler";
import { pickSessionChallenges, SESSION_SIZE } from "@/lib/arena/session";
import type { Challenge } from "@/lib/arena/types";

function makeChallenge(id: string, courseSlug = "dsa"): Challenge {
  return {
    id,
    kind: "mcq",
    courseSlug,
    chapterSlug: "chapter-a",
    moduleTitle: "Module A",
    prompt: `prompt ${id}`,
    options: ["a", "b"],
    correctIndex: 0,
    why: "why",
  };
}

describe("pickSessionChallenges", () => {
  const now = new Date("2026-01-10T10:00:00Z");
  const pool = Array.from({ length: 30 }, (_, i) => makeChallenge(`c${i}`));

  it("returns SESSION_SIZE challenges with no duplicates when the pool is large", () => {
    const picked = pickSessionChallenges(pool, {}, now, "seed-1");
    expect(picked).toHaveLength(SESSION_SIZE);
    expect(new Set(picked.map((c) => c.id)).size).toBe(SESSION_SIZE);
  });

  it("returns nothing for an empty pool", () => {
    expect(pickSessionChallenges([], {}, now, "seed-1")).toEqual([]);
  });

  it("tops up with everything available when the pool is smaller than the session size", () => {
    const small = pool.slice(0, 3);
    const picked = pickSessionChallenges(small, {}, now, "seed-1");
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((c) => c.id))).toEqual(new Set(small.map((c) => c.id)));
  });

  it("prioritises a due card ahead of unseen challenges", () => {
    const due: Record<string, ReviewState> = {
      c5: { ...newReviewState(now), due: new Date(now.getTime() - 1000).toISOString() },
    };
    const picked = pickSessionChallenges(pool, due, now, "seed-1");
    expect(picked[0]!.id).toBe("c5");
  });

  it("does not include a card that has been seen but is not yet due", () => {
    const notDueYet: Record<string, ReviewState> = {
      c7: scheduleNext(undefined, true, now), // due comfortably in the future
    };
    const picked = pickSessionChallenges(pool, notDueYet, now, "seed-1");
    expect(picked.find((c) => c.id === "c7")).toBeUndefined();
  });

  it("filters to one course when courseSlug is given", () => {
    const mixed = [...pool.slice(0, 5), makeChallenge("java-1", "java"), makeChallenge("java-2", "java")];
    const picked = pickSessionChallenges(mixed, {}, now, "seed-1", SESSION_SIZE, "java");
    expect(picked.every((c) => c.courseSlug === "java")).toBe(true);
  });

  it("is deterministic for the same seed and inputs", () => {
    const first = pickSessionChallenges(pool, {}, now, "seed-42").map((c) => c.id);
    const second = pickSessionChallenges(pool, {}, now, "seed-42").map((c) => c.id);
    expect(second).toEqual(first);
  });

  it("varies with a different seed (in general)", () => {
    const a = pickSessionChallenges(pool, {}, now, "seed-a").map((c) => c.id);
    const b = pickSessionChallenges(pool, {}, now, "seed-b").map((c) => c.id);
    expect(b).not.toEqual(a);
  });
});
