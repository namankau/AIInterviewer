import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { courses } from "@/content/courses";
import {
  ARENA_OPEN_SOURCE_REGISTRY,
  openSourceArenaChallenges,
} from "@/content/arena/open-source-challenges";
import { allArenaChallenges } from "@/lib/arena/corpus";

describe("open-source Arena supplement", () => {
  it("has reviewed, pinned MIT provenance for every adapted challenge", () => {
    for (const challenge of openSourceArenaChallenges) {
      expect(challenge.source).toMatchObject({
        license: "MIT",
        reviewedOn: "2026-09-24",
      });
      expect(challenge.source!.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(challenge.source!.revisionDate).toMatch(/^2026-09-\d{2}$/);
      expect(challenge.source!.url).toContain(challenge.source!.revision);
      expect(challenge.source!.url).not.toContain("/main/");
      expect(challenge.why.trim()).not.toBe("");
    }
  });

  it("maps every question to a real course, module and chapter", () => {
    for (const challenge of openSourceArenaChallenges) {
      const course = courses.find((candidate) => candidate.slug === challenge.courseSlug);
      expect(course, challenge.id).toBeDefined();
      const courseModule = course!.modules.find((candidate) => candidate.title === challenge.moduleTitle);
      expect(courseModule, challenge.id).toBeDefined();
      expect(courseModule!.chapters.some((chapter) => chapter.slug === challenge.chapterSlug), challenge.id).toBe(true);
    }
  });

  it("supplements each of the three courses and keeps every corpus id unique", () => {
    expect(new Set(openSourceArenaChallenges.map((challenge) => challenge.courseSlug))).toEqual(
      new Set(["java", "dsa", "ai-agents"]),
    );
    const ids = allArenaChallenges.map((challenge) => challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers all four upstream repositories and vendors the required MIT notices", () => {
    expect(Object.keys(ARENA_OPEN_SOURCE_REGISTRY)).toHaveLength(4);
    const notices = readFileSync(resolve(process.cwd(), "src/content/arena/THIRD_PARTY_NOTICES.md"), "utf8");
    for (const registered of Object.values(ARENA_OPEN_SOURCE_REGISTRY)) {
      expect(notices).toContain(registered.revision);
    }
    expect(notices).toContain("Permission is hereby granted, free of charge");
  });
});
