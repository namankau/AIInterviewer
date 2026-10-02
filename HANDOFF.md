# Handoff — 2026-10-02

## Start here (for the next agent, Codex or Claude)
Where the repository stands at the end of this run:

- **`develop` is the source of truth.** Every feature branch is merged and has been
  deleted, locally and on GitHub. No PR is open into `develop`.
- **A release PR `develop` → `main` is open, waiting for the owner to merge it.** Once it
  is merged, `main` and `develop` have the same content. Never push to `main` yourself
  (CLAUDE.md / AGENTS.md rule 1).
- **CI is green on `develop`.** Both jobs pass: web (typecheck, lint, test, build) and API
  (ktlint, test, build).
- **No migrations are pending.** Task 065 made no schema change.
- **Untracked on purpose:** `.codex/` (Codex agent profiles) and `AGENTS.md`. They exist
  only on the owner's machine.
- **Start any new work from `origin/develop`:**
  `git fetch origin && git checkout -b <branch> origin/develop`.
- **The latest task file is `tasks/task-065-…`, and it is complete.** The next task is 066.

## Task
Task 065: learning depth, account isolation, and sourced loop discovery
(`tasks/task-065-learning-depth-account-isolation-and-sourced-loops.md`). Codex started it
on 29 Sep. Claude Code finished it on 2 Oct, and the owner merged it as PR #22.

## What was built (all now on `develop`)
- **Account isolation (PRD §05), `d4bb716`:**
  - Dashboard, profile and course-progress state each record which access token fetched
    them, and are shown only while that token is the active one.
  - A previous account's data cannot show or change after sign-out or an account switch.
  - Late responses from an old request are discarded, and failed refreshes clear the
    data instead of leaving stale data on screen.
  - Tests: `dashboard-panel.identity.test.tsx`, `profile-panel.test.tsx`,
    `course-progress.test.tsx`.
- **Interview room (PRD §07), `0bc42a3`:** removed the notice offering to switch to
  writing when the interviewer's audio was unavailable.
- **Courses (PRD §09), `26320e6`:**
  - Every concept now gets beginner-first definitions, examples and a multi-point
    Remember recap.
  - Content-integrity tests enforce this for every chapter.
- **CI and bug fixes, `ec51286`:**
  - Fixed 3 `react-hooks` lint errors that had failed CI on every Codex push.
  - Fixed `importLegacyProgress` reporting a successful server import as a failure.
- **Sourced employer research (PRD §04), `bfd8b3f`:**
  - **When it runs:** for a company with no sourced stage, the loop brief runs a Gemini
    call with the `googleSearch` tool.
  - **What is kept (`ai/GroundedAnswer.kt`):** only sentences that Gemini's grounding ties
    to a page. Each claim keeps numbered citations, and unsupported sentences are dropped.
  - **Which models can serve it:** only providers with `AiCapability.WEB_GROUNDING`
    (Gemini), never a text-only model.
  - **Cache (`loopbrief/PublicLoopResearch.kt`):** in memory, 12h, 500 entries. It caches
    "nothing found" but not failed calls.
  - **Switch:** `INTERVIEWOS_PUBLIC_LOOP_RESEARCH`, on by default.
  - **API:** `LoopBriefView.publicSourcePattern` (`claims[]` plus `sources[]`), mirrored in
    `packages/shared/src/loop-brief.ts`.
  - **UI (`loop-brief-step.tsx`):** a separate "Found in public sources" section labelled
    as an AI summary. The archetype pattern is still shown below it.

## Assumptions made
- "Unknown employer" means no sourced stage. Our own sourced record always outranks the
  search.
- The cache is in memory, not a table, because Gemini's citation links are expiring
  redirect URLs.
- The prep plan does not use the search results yet.

## What could NOT be verified
- **No live Gemini call has been made** for the grounded search (rule 7). Untested: answer
  quality, latency, and search-tool behaviour on each model in the chain.
- **Google's Search Suggestions requirement:** grounded results may have to show
  `searchEntryPoint.renderedContent`. This is not implemented, and it needs the owner's
  legal decision.
- **Cost tracking:** grounded searches are billed per query, and `AiPrices` records tokens
  only.
- Visual design of the new section.

## Verification status
- Backend `ktlintCheck test build`: pass.
- Web typecheck, lint, tests (57 files / 2,921 tests), build (174 pages): pass.
- GitHub CI on the task 065 head: web and API green (run `36964102931`).

## Merge status
- Task 065 was merged into `develop` through PR #22 (merge commit `fd0d2d9`).
- A release PR `develop` → `main` is open for the owner.
- Deleted branches, all fully merged:
  - `feat/learning-data-integrity` (local and remote)
  - `fix/interview-audio-observability` (remote)
  - `fix/web-workspace-build` (local)

## Suggested next task
- Task 066: once the owner approves, make a few live grounded calls (1–2 well-known and
  1–2 obscure employers). Then implement the Search Suggestions display if the owner
  requires it, and add the per-query search charge to `AiPrices`.

## Open questions for the owner
- Must grounded results render Google's Search Suggestions chip? If so, keep
  `INTERVIEWOS_PUBLIC_LOOP_RESEARCH=false` in production until it is built.
