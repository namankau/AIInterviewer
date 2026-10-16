import { describe, expect, it } from "vitest";

import { shuffleScenarioOptions } from "@/lib/arena/shuffle-options";

describe("scenario answer order", () => {
  it("shuffles a copy while keeping stable option IDs for grading", () => {
    const source = [{ id: "a", text: "One" }, { id: "b", text: "Two" }, { id: "c", text: "Three" }];
    const shuffled = shuffleScenarioOptions(source, () => 0);
    expect(shuffled.map((option) => option.id)).toEqual(["b", "c", "a"]);
    expect(source.map((option) => option.id)).toEqual(["a", "b", "c"]);
  });
});
