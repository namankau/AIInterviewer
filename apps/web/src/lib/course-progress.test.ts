import { describe, expect, it } from "vitest";

import { parseProgress, serializeProgress, summarizeChapters, withChapter } from "@/lib/course-progress";

const chapters = [
  { slug: "a", title: "A" },
  { slug: "b", title: "B" },
  { slug: "c", title: "C" },
  { slug: "d", title: "D" },
];

describe("summarizeChapters", () => {
  it("counts zero and points at the first chapter for a new learner", () => {
    const s = summarizeChapters(chapters, []);
    expect(s).toMatchObject({ done: 0, total: 4, percent: 0, started: false, finished: false });
    expect(s.next?.slug).toBe("a");
  });

  it("points at the first chapter not done, in reading order, even when later ones are ticked", () => {
    const s = summarizeChapters(chapters, ["a", "c"]);
    expect(s.done).toBe(2);
    expect(s.percent).toBe(50);
    expect(s.next?.slug).toBe("b");
  });

  it("is finished, with nothing next, once every chapter is done", () => {
    const s = summarizeChapters(chapters, ["a", "b", "c", "d"]);
    expect(s.finished).toBe(true);
    expect(s.percent).toBe(100);
    expect(s.next).toBeUndefined();
  });

  it("ignores ticked slugs that no longer exist, so it can never exceed 100%", () => {
    const s = summarizeChapters(chapters, ["a", "removed-chapter", "renamed-chapter"]);
    expect(s.done).toBe(1);
    expect(s.percent).toBe(25);
  });

  it("does not divide by zero for a course with no chapters", () => {
    expect(summarizeChapters([], ["a"])).toMatchObject({ total: 0, percent: 0, finished: false });
  });
});

describe("withChapter", () => {
  it("adds and removes a chapter without mutating the input", () => {
    const start = { java: ["a"] };
    const added = withChapter(start, "java", "b", true);
    expect(added.java).toEqual(["a", "b"]);
    expect(start.java).toEqual(["a"]);
    expect(withChapter(added, "java", "a", false).java).toEqual(["b"]);
  });

  it("is idempotent and keeps courses separate", () => {
    const once = withChapter({}, "java", "a", true);
    expect(withChapter(once, "java", "a", true).java).toEqual(["a"]);
    expect(withChapter(once, "dsa", "a", true)).toEqual({ java: ["a"], dsa: ["a"] });
  });
});

describe("parseProgress", () => {
  it("round-trips what it writes", () => {
    const value = { java: ["a", "b"], dsa: ["x"] };
    expect(parseProgress(serializeProgress(value))).toEqual(value);
  });

  it.each([null, undefined, "", "not json", "null", "42", '"str"', '{"version":2,"completed":{}}', '{"version":1}'])(
    "degrades to empty for %s",
    (raw) => {
      expect(parseProgress(raw)).toEqual({});
    },
  );

  it("drops non-string entries instead of trusting them", () => {
    expect(parseProgress('{"version":1,"completed":{"java":["a",1,null,"b"],"bad":"x"}}')).toEqual({
      java: ["a", "b"],
    });
  });
});
