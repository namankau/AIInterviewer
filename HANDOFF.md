# Handoff — 2026-10-03 (loop brief: no "unsourced employer" banner)

## Start here (for the next agent, Codex or Claude)
- PR #24 (production-readiness quick wins) is merged into `develop`.
- **No migrations are pending.** This run made no schema change.
- **Untracked on purpose:** `.codex/` and `AGENTS.md`, which exist only on the owner's
  machine.
- Start new work from `origin/develop`. The next task file is 066.

## Task
Owner request (3 Oct), no task file. The loop brief for Infosys opened with "We don't hold
a sourced account of Infosys's process yet — what follows is the usual pattern…". The
owner had said this message must never appear. When we hold nothing, the brief should
fetch the information from the internet or from the AI instead. PRD §04.

## What I built
- **New fallback step: the model's own knowledge**
  (`apps/api/.../loopbrief/ModelEmployerKnowledge.kt`).
  - Order of sources is now: our sourced record → grounded web search (task 065) → the
    model's knowledge → the archetype pattern.
  - It reuses the question pool's existing cold knowledge check
    (`assessEmployerKnowledge`, `prompts/employer-knowledge.md`). No new prompt or schema.
  - An answer survives only if `knowsProcess` is true **and** it names at least one round,
    value or format. This is the same bar `PoolAssociationGate` uses.
  - Answers are cached in memory per employer for 7 days, misses included. An outage is
    not cached.
  - Config: `interviewos.loop-brief.model-knowledge.*`, switch
    `INTERVIEWOS_MODEL_LOOP_KNOWLEDGE` (default on).
- **API:** `LoopBriefView.modelKnowledge` (new field), plus the shared TS type
  `ModelEmployerKnowledge` in `packages/shared/src/loop-brief.ts`.
- **Web** (`apps/web/src/components/loop-brief-step.tsx`):
  - The header caveat is removed in all three variants: the "no sourced account" one,
    the "we don't know X specifically" one, and the "no verified account" one.
  - A new "From AI knowledge" section shows the model's account, rounds, formats and
    values. It says plainly that this comes from the model's training, has no linked
    page, and may be dated.
- **Tests:**
  - `ModelEmployerKnowledgeTest` (new).
  - `LoopBriefServiceTest`: fallback order, and the search outranking the model.
  - `loop-brief-step.test.tsx`: no disclaimer in any state; the new section is rendered
    and labelled.

## Assumptions I made
- "Never show this message" means the banner. Provenance stays, as **per-section labels**:
  "From <employer>'s own record", "Found in public sources", "From AI knowledge" and
  "General pattern for …". CLAUDE.md requires every piece of employer knowledge to carry
  its tier. A small label honours that rule without a banner saying we know nothing.
- If the search and the model both have nothing, the brief shows only the labelled
  general pattern, with no disclaimer.

## What I could NOT verify
- **Why the Infosys web search came back empty in the first place.** The live API logs
  were not available to me. Look for `Could not research public sources for Infosys` (an
  outage) versus no warning at all (nothing citable survived `GroundedAnswer`). If the
  search is failing for every employer, that is a separate bug.
- What the model actually returns for Infosys. Rule 7 forbids live AI calls without the
  owner's go-ahead. One page load of an Infosys brief after deploy will show it.

## Verification status
- All pass. Locally and on CI run 37107054537: the API job (ktlint, test, build) and the
  web job (typecheck, lint, test, build). A first local web run failed while the API
  build ran beside it; a clean rerun passed all 2925 tests, so it looks like a timeout
  under load.

## Merge status
- Merged into `develop` at `9b0951a` after green CI. No migration.

## Suggested next task
- Check the grounded-search logs for Infosys and fix the search if it is failing
  broadly.

## Open questions for you
- None.
