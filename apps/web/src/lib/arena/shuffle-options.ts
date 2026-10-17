import type { ScenarioOption } from "@untiered/shared";

export function shuffleScenarioOptions(options: ScenarioOption[], random = Math.random): ScenarioOption[] {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const chosen = shuffled[target]!;
    shuffled[target] = shuffled[index]!;
    shuffled[index] = chosen;
  }
  return shuffled;
}
