# Task 041 — Pool generators: behavioural, fundamentals, HR, case, techno-managerial

PRD §08 (question archetypes), §09 (rounds). Depends on **task 039** (pool tables, the
`QuestionGenerator` interface, the generation job, dedupe, spend cap).
Read `CLAUDE.md` first. **Rule 7 applies: write the generators and test them with the AI
mocked at the boundary. Do not call Gemini.** Task 043 runs them, after the owner approves.

Branch from `origin/develop` and, if 039 is not yet merged when you start, from 039's
branch — say in your report which base you used. This task runs alongside 040; keep out of
its files (coding and system design are its round types, these five are yours).

## Why

These are the round types the competing tools treat as filler, and they are where this
product's coverage claim is actually made good: a service-based IT firm's HR round, a
techno-managerial round, a European employer's competency interview, a case round. A round
type nobody pre-generates for is a round type that runs on whatever the model improvises.

## The five

### Behavioural / STAR

- Mapped to **each company's own stated values** where the model genuinely knows them —
  Amazon's leadership principles, Netflix's culture memo, and so on. This is exactly what
  task 039's `company_specific` / `employer_kind` gate is for: values the model cannot name
  with confidence mean an `employer_kind` question about the kind of behaviour that kind of
  employer probes.
- **Never invent a company's values.** A fabricated leadership principle attributed to a real
  employer is the failure mode `CLAUDE.md` calls the most damaging this product has. Store
  which value a question maps to, so the report can say it and a reviewer can check it.
- Follow-ups are **STAR follow-ups**: the ones that push on the part candidates skip —
  what was actually yours versus the team's, what the result was, what you would change.

### Technical fundamentals

- Per role family, from task 039's wave-1 list: backend, full-stack/frontend, mobile,
  QA/automation, data engineering, ML/AI, SRE. Fundamentals for one family are not
  fundamentals for another — do not generate one set and tag it seven ways.
- Depth follows level: `entry` gets "what and why", `staff` gets trade-offs and failure modes.

### HR / fit

- Task 039 ships a reference HR generator so its job is testable end to end. **Extend it,
  do not fork it** — if 039's version is thin, that is the intent; make it the real one.
- Notice periods, relocation, compensation expectations, why this employer, gaps in a CV.
  Service-based IT firms interview differently here from product companies; the archetype
  drives the difference.

### Case

- Structured problem-solving with the data given, an estimate to make, and a recommendation.
  Non-engineering corporate functions and consulting-flavoured rounds at product companies.
- Each case carries the data the candidate is given and what a strong answer concludes.

### Techno-managerial

- The round that decides between doing and leading: prioritisation under constraint, an
  incident, a disagreement with a stakeholder, an estimate someone else has to live with.
- Mostly `senior` and `staff`. Generate sparsely at `entry`, and say in the report how you
  weighted it.

## Both prompts and code

- Implement `QuestionGenerator` from task 039, one per round type. The job already handles
  rate limiting, the spend cap, resumability, dedupe and the `ai_calls` ledger — do not
  reimplement any of it.
- Every question carries 2–3 follow-ups and what a strong answer covers (039's schema).
- Prompts in `apps/api/src/main/resources/ai/prompts/`, schemas in `ai/schemas/`, following
  what is there.
- Bump `generator_version` and say what changed.

## Testing

- Unit-test each generator against a mocked `InterviewAi`: a well-formed response, a
  malformed one, one that trips the association gate, and — for behavioural — one that
  returns a value the gate did not license, which must be downgraded rather than stored as a
  company claim.
- Task 037's lesson: **load and validate each new prompt and schema file in a test**, so a
  malformed one fails CI rather than a live run.
- No test may depend on a live third-party API (`CLAUDE.md`).

## Not in this task

Coding and system design (040). Rounds using the pool, the report label, hiding `/questions`
(042). Running the job (043). Any new function vertical — CA, consulting as a career track,
automobile — each needs a rubric built with domain input and is the owner's call.

## Done when

All five generators exist and are tested with the AI mocked, the behavioural generator cannot
attribute a value to a company the gate did not license, prompt and schema files are
validated by a test, **no live model call was made**, CI is green on
`feat/pool-behavioural-generators`, and the report says how the value mapping is stored and
how techno-managerial was weighted by level.
