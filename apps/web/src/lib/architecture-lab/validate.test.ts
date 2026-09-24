import { describe, expect, it } from "vitest";

import { architectureScenarios, getArchitectureScenario } from "@/lib/architecture-lab/scenarios";
import {
  emptyArchitecturePlacement,
  validateArchitecture,
  validateScenarioDefinition,
} from "@/lib/architecture-lab/validate";

describe("architecture scenario registry", () => {
  it("contains four valid, sourced, independently addressable scenarios", () => {
    expect(architectureScenarios).toHaveLength(4);
    for (const scenario of architectureScenarios) {
      expect(validateScenarioDefinition(scenario), scenario.id).toEqual([]);
      expect(getArchitectureScenario(scenario.id)).toBe(scenario);
      expect(scenario.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
    }
  });

  it("models genuine trade-offs by accepting more than one placement in every scenario", () => {
    for (const scenario of architectureScenarios) {
      expect(scenario.components.some((component) => component.acceptedZoneIds.length > 1)).toBe(true);
    }
  });
});

describe("validateArchitecture", () => {
  const scenario = getArchitectureScenario("url-shortener")!;

  it("starts empty and reports each component as unplaced", () => {
    const result = validateArchitecture(scenario, emptyArchitecturePlacement(scenario));
    expect(result.correct).toBe(false);
    expect(result.placedCount).toBe(0);
    expect(result.results["link-api"]?.message).toMatch(/place this component/i);
  });

  it("accepts either documented cache location and remains deterministic", () => {
    const base = {
      "link-api": "service",
      "mapping-store": "data",
      "analytics-worker": "background",
    };
    const atEdge = validateArchitecture(scenario, { ...base, "redirect-cache": "edge" });
    const byService = validateArchitecture(scenario, { ...base, "redirect-cache": "service" });

    expect(atEdge.correct).toBe(true);
    expect(byService.correct).toBe(true);
    expect(validateArchitecture(scenario, { ...base, "redirect-cache": "service" })).toEqual(byService);
  });

  it("marks a complete but unsound arrangement as incorrect", () => {
    const result = validateArchitecture(scenario, {
      "redirect-cache": "data",
      "link-api": "edge",
      "mapping-store": "background",
      "analytics-worker": "service",
    });
    expect(result.placedCount).toBe(result.totalCount);
    expect(result.correct).toBe(false);
  });
});
