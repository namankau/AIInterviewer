import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultProgress, loadProgress, saveProgress } from "@/lib/arena/storage";

describe("arena storage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns default progress when nothing has been saved yet", () => {
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("round-trips a save and a load", () => {
    const progress = defaultProgress();
    progress.xp = 120;
    progress.streak = { current: 3, longest: 5, lastActiveDate: "2026-01-01" };
    progress.badges = ["streak-7"];
    progress.masteredChallengeIds = ["mcq-java-01-abc"];
    saveProgress(progress);
    expect(loadProgress()).toEqual(progress);
  });

  it("degrades to default progress on corrupt JSON rather than throwing", () => {
    window.localStorage.setItem("arena:v1", "{not valid json");
    expect(() => loadProgress()).not.toThrow();
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("degrades to default progress on an absent key", () => {
    window.localStorage.removeItem("arena:v1");
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("degrades to default progress on a future/unknown schema version", () => {
    window.localStorage.setItem("arena:v1", JSON.stringify({ version: 99, xp: 500 }));
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("degrades to default progress on a bare null or a non-object payload", () => {
    window.localStorage.setItem("arena:v1", "null");
    expect(loadProgress()).toEqual(defaultProgress());
    window.localStorage.setItem("arena:v1", '"just a string"');
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("fills in missing fields from a partial record instead of discarding the whole thing", () => {
    window.localStorage.setItem("arena:v1", JSON.stringify({ version: 1, xp: 40 }));
    const loaded = loadProgress();
    expect(loaded.xp).toBe(40);
    expect(loaded.streak).toEqual(defaultProgress().streak);
    expect(loaded.badges).toEqual([]);
  });

  it("never throws when localStorage.getItem itself throws (private window / blocked storage)", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage is blocked");
    });
    expect(() => loadProgress()).not.toThrow();
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it("never throws when localStorage.setItem itself throws (quota exceeded)", () => {
    vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveProgress(defaultProgress())).not.toThrow();
  });
});
