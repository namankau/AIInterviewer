# Task 048 — Mock interview quality for freshers and campus placements

## Why

The owner: *"the mock interview quality can be made much better for freshers especially.
Those who are in college and campus placements are about to start, they might use our
product for preparation."*

This is a strong strategic fit. Campus placement season is a hard deadline for millions of
Indian students, and CLAUDE.md already commits to service-based IT firms as first-class —
which is exactly where campus hiring happens at volume.

## Read the research before you design anything

`C:\Users\naman\AppData\Local\Temp\claude\c--Users-naman-Documents-Live-Projects-naman06github-AIInterviewer\cc7338a4-6be2-49c0-8ea4-17da285848e1\scratchpad\research-fresher.md`

**Its most important finding is a negative one, and it constrains this whole task:**

- There is **no** open-licensed Indian-campus interview corpus, **no** open aptitude /
  quantitative / logical-reasoning corpus, and **no** open DSA problem-statement corpus.
  CSES and Project Euler are CC BY-NC-SA — the NonCommercial clause disqualifies them
  outright. Codeforces' terms forbid republishing. So for this material there is no wheel
  to avoid reinventing: **generate it through the existing AI question-pool generator.**
- Genuinely usable, with attribution: `yangshun/tech-interview-handbook` (MIT),
  `donnemartin/system-design-primer` (CC BY 4.0), `kdn251/interviews` (MIT). None are
  campus-India-specific.
- Four smaller "CS fundamentals" repos were found but their LICENSE files were **not
  checked**. An unlicensed public repo is all-rights-reserved. **Do not use any of them
  unless you open the LICENSE yourself and confirm it.**

### The provenance trap — read this twice

The researcher could not load TCS's or Infosys's own careers pages (HTTP 403). **Every
specific number in circulation about TCS NQT / Infosys / Wipro test structure — duration,
section counts, question counts, cutoffs — traces to third-party prep aggregators, not to
the employer.**

CLAUDE.md: *"a confidently invented claim about a real company's process is the single most
damaging failure mode this product has."*

Therefore, and without exception:

- **Do not encode any employer-specific test structure as `published_source`.** No "the TCS
  NQT is 90 minutes with N sections" anywhere in code, content, prompts or fixtures.
- Model campus hiring at **archetype level** — a service-based-IT campus process, a
  product-company campus process — describing what such processes *typically* contain, and
  saying plainly that it is a general pattern.
- If a named employer's process is ever stated specifically, it must come from the existing
  source library with a real URL, at `published_source` tier, through the machinery that
  already exists. Anything else is `model_knowledge` and must be labelled as such to the
  user, using the labelling that already exists.
- Where you would have to invent to be specific, be general instead and say so. That is the
  product working correctly, not a gap.

## Scope

### 1. The aptitude round — the defining gap

`RoundType` has eight values and none of them is aptitude. For Indian campus placement,
aptitude/reasoning is usually the *first gate* — a candidate who fails it never reaches a
technical round. A fresher product without it is missing the thing that eliminates most
candidates.

- Add `APTITUDE` to `RoundType` (quantitative, logical reasoning, verbal ability, data
  interpretation), with `covers` and `resumeUse` set the way the existing values are.
- Add a generator alongside the existing ones in `apps/api/src/main/kotlin/.../pool/`
  (follow `TechnicalFundamentalsQuestionGenerator.kt` closely — same shape, same
  sanitising, same provenance handling).
- **Aptitude is mostly not a spoken round in reality**, and this product is voice-first.
  Resolve this deliberately and record the decision: the defensible interpretation is a
  spoken, reasoning-out-loud aptitude round ("talk me through how you'd work this out"),
  which is what actually helps a student and what the platform can uniquely do — an
  aggregator can already give them a timed MCQ. Do not build a timed MCQ engine in this
  task; if you conclude one is needed, flag it, do not build it.
- Migration required for any new enum db value. Follow the existing migration style in
  `supabase/migrations/`. Note in your report that the orchestrator must apply it at merge.

### 2. Fresher calibration — the actual quality win

This is the heart of the task and matters more than any new round type. Today `Level.ENTRY`
exists but almost nothing behaves differently for a fresher. A student gets an interview
pitched at someone with a job history, which is the single clearest way this product
currently fails them.

Work through the round planning, persona and prompt layers and make a fresher interview
actually read like one:

- **`SYSTEM_DESIGN` must never be selected for an entry-level campus candidate.** Verify
  what currently prevents it; if nothing does, that is a bug to fix.
- **`PROJECT_DEEP_DIVE` for a student means their college project, final-year project, or
  internship** — not production work, not scale, not on-call. The interviewer must not ask
  "what happened when this broke in production" of someone who has never shipped. Probe
  instead: what they personally wrote versus what the team wrote, why they chose that
  library, what they would do differently, whether they understand the code they submitted.
- **`HR_FIT_CLOSING` for a campus candidate** has its own real shape: why this company,
  relocation, service agreements/bonds, willingness to be trained on any technology, the
  gap between what they studied and the role. Keep it honest and archetype-level.
- **`TECHNICAL_FUNDAMENTALS` for a fresher is syllabus-shaped** — OS, DBMS, Computer
  Networks, OOP — because that is what a student has actually studied. Make sure the
  generator can produce that for entry level.
- **Calibrate the bar.** A fresher answer should be judged against what a final-year
  student can reasonably know, not against a mid-level engineer. Find where scoring and
  the report describe the bar, and make level a real input.
- **Feedback tone for a student should be instructive, not just evaluative.** A student
  needs to know what to study next. Keep it evidence-backed — never invent a quote, never
  describe how anybody looked (see CLAUDE.md on `presenceWasObserved`).

### 3. Behavioural prep content, properly attributed

`yangshun/tech-interview-handbook` (MIT) documents STAR framing built on academic and
project stories rather than job history, and the small set of recurring behavioural
questions worth preparing. That is directly applicable and legitimately reusable.

If you use it, **honour the MIT licence**: attribution in the repo, and a note in
HANDOFF.md. Do not paste large verbatim blocks — use it as a source, and say it is one.

### 4. Tests

- Unit tests for round selection at entry level, including a test that asserts a campus
  fresher is never given a system-design round.
- Unit tests for the aptitude generator, mocked at the AI boundary (project rule: no test
  may depend on a live third-party API).
- At least one integration test for any endpoint touched: happy path plus an auth-failure
  path.
- A test that pins the provenance rule: a campus process claim with no source is not
  emitted at `published_source` tier.

## Out of scope — flag, do not build

- **Group discussion.** It is a real part of campus placement, but it needs multiple
  simultaneous speakers, which is a different interaction model from this product's
  turn-based voice loop. Flag it in HANDOFF.md as a candidate for its own task.
- A timed multiple-choice aptitude test engine.
- Any scraping whatsoever.
- Community-contributed reports and salary data — later phases, per CLAUDE.md.

## Non-negotiables

- Never weaken, skip, or ignore a test to get green.
- No live AI calls, no prompt harness runs against Gemini, no data-generation jobs that
  spend. Test by code with the AI mocked at the boundary.
- No secrets in tracked files.
- If this grows beyond ~800 changed lines, say so in your report and suggest the split.

## Verification

```bash
cd apps/api && ./gradlew ktlintCheck test build
```

Push the branch. Do not merge — the orchestrator merges on green CI and applies migrations.
