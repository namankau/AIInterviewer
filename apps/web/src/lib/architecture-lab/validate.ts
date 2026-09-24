import type {
  ArchitectureCheck,
  ArchitecturePlacement,
  ArchitectureScenario,
} from "@/lib/architecture-lab/types";

export function emptyArchitecturePlacement(scenario: ArchitectureScenario): ArchitecturePlacement {
  return Object.fromEntries(scenario.components.map((component) => [component.id, null]));
}

/** Pure, deterministic validation. The UI and future Arena adapter can share this verbatim. */
export function validateArchitecture(
  scenario: ArchitectureScenario,
  placement: ArchitecturePlacement,
): ArchitectureCheck {
  const results: ArchitectureCheck["results"] = {};
  let placedCount = 0;

  for (const component of scenario.components) {
    const zoneId = placement[component.id] ?? null;
    if (zoneId) placedCount += 1;
    const correct = zoneId !== null && component.acceptedZoneIds.includes(zoneId);
    results[component.id] = {
      correct,
      message: zoneId === null ? "Place this component before checking." : component.feedback,
    };
  }

  return {
    correct: scenario.components.length > 0 && scenario.components.every(({ id }) => results[id]?.correct),
    placedCount,
    totalCount: scenario.components.length,
    results,
  };
}

export function validateScenarioDefinition(scenario: ArchitectureScenario): string[] {
  const errors: string[] = [];
  const zoneIds = new Set(scenario.zones.map(({ id }) => id));
  const componentIds = new Set<string>();

  if (!scenario.id.trim() || !scenario.title.trim() || !scenario.brief.trim()) {
    errors.push("Scenario id, title, and brief are required.");
  }
  if (zoneIds.size !== scenario.zones.length) errors.push("Zone ids must be unique.");
  if (scenario.zones.some((zone) => !zone.id.trim() || !zone.label.trim())) {
    errors.push("Every zone needs an id and label.");
  }
  if (scenario.components.length === 0) errors.push("At least one component is required.");
  if (scenario.sources.length === 0) errors.push("At least one provenance source is required.");
  if (scenario.sources.some((source) => !source.title.trim() || !source.license.trim() || !source.url.startsWith("https://"))) {
    errors.push("Every source needs a title, license, and HTTPS URL.");
  }

  for (const component of scenario.components) {
    if (componentIds.has(component.id)) errors.push(`Duplicate component id: ${component.id}`);
    componentIds.add(component.id);
    if (component.acceptedZoneIds.length === 0) errors.push(`${component.id} has no accepted zone.`);
    for (const zoneId of component.acceptedZoneIds) {
      if (!zoneIds.has(zoneId)) errors.push(`${component.id} references missing zone ${zoneId}.`);
    }
  }
  return errors;
}
