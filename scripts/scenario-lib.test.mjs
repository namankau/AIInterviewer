import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalogue, loadScenarios, validateScenario } from "./scenario-lib.mjs";

const catalogue = loadCatalogue();
const { scenarios } = loadScenarios();
const base = scenarios.find((s) => s.course_slug === "dsa");
const copy = () => structuredClone(base);

test("all authored scenarios validate and have 5 ordered steps", () => {
  assert.equal(scenarios.length, 6);
  for (const scenario of scenarios) {
    assert.equal(scenario.steps.length, 5);
    assert.deepEqual(validateScenario(scenario, catalogue), []);
  }
});

test("rejects missing, duplicate, and too few options", () => {
  const missing = copy(); missing.steps[0].correct_option_id = "missing";
  assert.match(validateScenario(missing, catalogue).join(";"), /exactly one correct/);
  const duplicate = copy(); duplicate.steps[0].options[1].id = duplicate.steps[0].options[0].id;
  assert.match(validateScenario(duplicate, catalogue).join(";"), /duplicate option/);
  const short = copy(); short.steps[0].options.pop();
  assert.match(validateScenario(short, catalogue).join(";"), /3-4 options/);
});

test("rejects missing explanation, probe context and unknown concepts", () => {
  const value = copy(); value.steps[1].context_note = ""; value.steps[2].explanation = "";
  value.steps[3].concept_ids = ["unknown"];
  const errors = validateScenario(value, catalogue).join(";");
  assert.match(errors, /probe without context_note/);
  assert.match(errors, /empty explanation/);
  assert.match(errors, /unknown concept id/);
});

test("checks complexity notation and code snippets", () => {
  const complexity = copy(); complexity.steps[1].options[0].text = "linear";
  assert.match(validateScenario(complexity, catalogue).join(";"), /invalid complexity expression/);
  const code = copy(); code.steps[0].step_type = "debug";
  assert.match(validateScenario(code, catalogue).join(";"), /code-based step without snippet/);
});
