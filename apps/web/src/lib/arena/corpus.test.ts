import { describe, expect, it } from "vitest";

import { dashboardQuestionPool } from "@/lib/arena/corpus";

describe("dashboard question bank", () => {
  it("is a substantial rotation of standalone, answerable multiple-choice questions", () => {
    expect(dashboardQuestionPool.length).toBeGreaterThan(50);
    for (const question of dashboardQuestionPool) {
      expect(question.kind).toBe("mcq");
      expect(question.prompt.trim().length).toBeGreaterThanOrEqual(20);
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(question.why.trim().length).toBeGreaterThanOrEqual(10);
    }
  });
});
