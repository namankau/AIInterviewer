# Task 040 — Pool generators: coding problems and system design

PRD §08 (question archetypes), §09 (rounds). Depends on **task 039** (pool tables, the
`QuestionGenerator` interface, the generation job, dedupe, spend cap).
Read `CLAUDE.md` first. **Rule 7 applies: write the generators and test them with the AI
mocked at the boundary. Do not call Gemini.** Task 043 runs them, after the owner approves.

Branch from `origin/develop` and, if 039 is not yet merged when you start, from 039's
branch — say in your report which base you used.

## Why

Coding and system design are the two round types where a live-written question costs the
most and helps the least. A coding problem written during the round has to be composed,
verified and have its tests generated while the candidate waits; a system-design case
written live tends to come out as a generic prompt with no constraints worth arguing about.

Both are much better pre-generated: there is time to verify them, and they can be reviewed.

## Coding

Use the existing `ProblemVerifier` / `ProblemHarness` and the `compose-problem` prompt and
schema (`apps/api/src/main/resources/ai/prompts/compose-problem.md`,
`ai/schemas/compose-problem.json`) — do not write a second problem pipeline.

- Generate **full problems in our own words**: statement, constraints, 2–3 worked examples,
  the reference solution, and test cases.
- **Verify before storing.** A problem whose reference solution does not pass its own test
  cases is not written to the pool — the cell counts it as dropped and says why. Pre-verified
  is the point: it takes the verification out of the round, so DSA setup gets faster.
- Store the verified artefacts alongside the question so the round does not redo the work.
  Extend `pool_questions` with a **nullable jsonb payload** (one additive migration,
  `20260915010000_pool_coding_payload.sql`) rather than a parallel table — the payload is
  round-type-specific detail about one question, not a separate entity. Document the shape
  in the migration comment and mirror it in a Kotlin data class, not a loose map.
- **Never reproduce a copyrighted problem statement.** Our own wording, our own examples. A
  problem that is recognisably a verbatim LeetCode statement is a defect, not a shortcut —
  say so in the prompt and check for near-identity against `bank_questions` through the
  task-039 deduplicator.
- Difficulty follows the cell's level: `entry` is not given a staff-level problem.

## System design

- Generate **cases with real constraints** — scale, traffic shape, consistency requirements,
  what already exists, what must not change. A case without constraints is not a design
  question, it is a topic.
- **LLD and machine-coding are tagged within system design**, not a separate round type. Add
  the tag as a column or an enum on the payload — your call, justify it — so task 042 can
  ask for one or the other. Machine-coding at `entry`/`mid`, distributed design at
  `senior`/`staff`, weighted by the cell's level.
- Each case carries what a strong answer covers and what a weak one misses, and 2–3
  follow-ups that push on the constraint that matters.

## Both

- Implement `QuestionGenerator` from task 039, one per round type. The generation job already
  handles rate limiting, the spend cap, resumability, dedupe and the `ai_calls` ledger — do
  not reimplement any of it.
- Respect the `company_specific` / `employer_kind` gate from 039. A design case that names a
  company's actual architecture is only allowed when the gate passed; otherwise the case is
  about the kind of system that kind of employer builds.
- Prompts live in `apps/api/src/main/resources/ai/prompts/`, schemas in `ai/schemas/`,
  following the naming and structure already there.
- Bump `generator_version` and say what changed.

## Testing

- Unit-test each generator against a mocked `InterviewAi`: a well-formed response, a
  malformed one, one that trips the association gate, and (coding) one whose reference
  solution fails verification.
- Task 037's lesson: a schema file that is malformed passes every test that never loads it.
  **Load and validate each new prompt and schema file in a test** so a broken one fails CI
  rather than a live run.
- No test may depend on a live third-party API (`CLAUDE.md`).

## Not in this task

Rounds using the pool, the report label, hiding `/questions` (042). Running the job (043).
Behavioural, fundamentals, HR, case and techno-managerial generators (041).

## Done when

Both generators exist and are tested with the AI mocked, coding problems are verified before
storage, the prompt and schema files are validated by a test, **no live model call was
made**, CI is green on `feat/pool-coding-design`, and the report says what the payload shape
is and how LLD/machine-coding is tagged.
