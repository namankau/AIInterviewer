import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalogue, validateScenario, ROOT } from "./scenario-lib.mjs";

// Offline authoring aid. Deliberately never imported by a play route. Requires an
// explicit command and API key; generated work is always draft pending human review.
const [courseSlug, conceptCsv, tier, countRaw] = process.argv.slice(2);
const count = Number(countRaw);
const course = loadCatalogue().courses.find((c) => c.slug === courseSlug);
const concepts = conceptCsv?.split(",") ?? [];
if (!course || concepts.some((id) => !course.concepts.some((c) => c.id === id)) || !["foundations", "intermediate", "advanced", "expert"].includes(tier) || !Number.isInteger(count) || count < 1 || count > 10) {
  throw new Error("Usage: node scripts/generate-scenarios.mjs <course> <concept-ids-csv> <tier> <count 1-10>");
}
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required; generation spends model tokens.");
const model = process.env.ARENA_GENERATOR_MODEL ?? "gemini-3.1-flash-lite";
const schema = readFileSync(join(ROOT, "scenario.schema.json"), "utf8");
const prompt = `Write ${count} distinct realistic ${course.title} interview practice scenarios as a JSON array. Each has a real-world hook and 5-6 ordered multiple-choice steps with 3-4 plausible options, one correct id, specific explanation of why every distractor fails, bottleneck_note and contextual probes. Every object must match this JSON schema: ${schema}. course_slug=${courseSlug}, tier=${tier}, concept_ids from ${JSON.stringify(concepts)}. Mark every status=draft. Do not claim these are real questions asked by any employer. Include solution_brief. Concepts: ${JSON.stringify(course.concepts)}.`;
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
});
if (!response.ok) throw new Error(`Gemini generation failed: ${response.status}`);
const body = await response.json();
const generated = JSON.parse(body.candidates?.[0]?.content?.parts?.[0]?.text ?? "null");
if (!Array.isArray(generated) || generated.length !== count) throw new Error("Expected a JSON array with the requested count.");
const catalogue = loadCatalogue();
for (const scenario of generated) {
  scenario.status = "draft";
  const errors = validateScenario(scenario, catalogue);
  if (errors.length) throw new Error(`${scenario.slug}: ${errors.join("; ")}`);
}
const dir = join(ROOT, courseSlug);
mkdirSync(dir, { recursive: true });
for (const scenario of generated) writeFileSync(join(dir, `${scenario.slug}.json`), `${JSON.stringify(scenario, null, 2)}\n`, { flag: "wx" });
console.log(`Saved ${generated.length} draft scenarios for manual review.`);
