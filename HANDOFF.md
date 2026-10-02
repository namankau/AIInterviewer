# Handoff — 2026-10-02

## Task
Learning depth, account isolation, and sourced loop discovery —
`tasks/task-065-learning-depth-account-isolation-and-sourced-loops.md`. Started by Codex on
29 Sep (first three commits), finished by Claude Code on 2 Oct.

## What I built
Codex had already committed three of the four scope items:
- `d4bb716` dashboard, profile and course-progress state is gated on the access token
  that fetched it (PRD §05).
- `0bc42a3` removed the writing-mode notice from the interview room (PRD §07).
- `26320e6` deepened every course's Explain and Remember material (PRD §09).

This run finished the fourth item, sourced employer-pattern discovery (PRD §04), and fixed
CI:
- **`ai/GroundedAnswer.kt`**: turns a search-grounded Gemini answer into claims, each
  tied to the pages behind it, using Gemini's `groundingSupports` / `groundingChunks`.
  **A sentence the grounding does not tie to a page is dropped**, which removes anything
  the model wrote from memory. Non-http(s) links are rejected, duplicate pages are merged,
  and there are at most 6 sources.
- **`GeminiInterviewAi.researchEmployerLoop`**: plain-text call with the `googleSearch`
  tool. New capability `AiCapability.WEB_GROUNDING`, so the fallback chain never sends
  this call to a text-only model, which would answer from memory.
- **`ai/prompts/public-employer-loop.md`**: write only what a found page says; check the
  company is the right one; no interview questions; no named people; reply
  `NO_PUBLIC_SOURCES` if nothing is found.
- **`loopbrief/PublicLoopResearch.kt`**: an in-memory cache in front of the search, keyed
  on (company, role family, level band), kept for 12h, max 500 entries. It also caches
  "nothing found". It does not cache outages. It is switched by
  `interviewos.loop-brief.public-research.enabled` (env `INTERVIEWOS_PUBLIC_LOOP_RESEARCH`,
  default `true`).
- **`LoopBriefService`**: runs the search **only when we hold no sourced stage** for the
  company. It returns `publicSourcePattern` (claims plus numbered sources), or null.
  The archetype `generalPattern` is always still returned.
- **Web, `loop-brief-step.tsx`**: a separate amber section titled "Found in public
  sources". Its text says it was "Summarised by AI from a web search, not checked by us".
  Each claim has numbered `[n]` links, and a numbered source list follows. The caveat
  changes to name the search. The section never uses the sourced stages' "own record"
  styling, and it is not rendered if `hasSources` is true.
- **CI fix**: all three Codex pushes had failed CI on 3 `react-hooks` lint errors in
  `dashboard-panel.tsx` and `profile-panel.tsx`, which meant the web tests never ran on
  CI. Fixes:
  - Removed the redundant state resets inside the effects. The token-gated `visible`
    already hides another account's data.
  - Profile feedback (error, busy, saved) now resets during render when the token changes.
  - The token ref is now synced in an effect.
- Tests:
  - `GroundedAnswerTest` (10 cases)
  - `PublicLoopResearchTest` (8 cases)
  - `LoopBriefServiceTest` (4 cases)
  - a `FallbackInterviewAiTest` case: the employer search is never handed to a text-only
    model
  - 2 `LoopBriefControllerTest` cases
  - 3 `loop-brief-step` UI cases

## Assumptions I made
- "Unknown employer" means **no sourced stage**, including companies in our directory that
  have no stage yet, not only companies missing from the directory. Our own sourced record
  always outranks a web search.
- The search runs on the brief request itself, not on a separate endpoint. A first-time
  lookup adds the search's latency (likely a few seconds) to the brief. Later lookups hit
  the cache.
- Kept in memory, not in a table: Gemini's citation links are
  `vertexaisearch.cloud.google.com/grounding-api-redirect/...` URLs that expire, so a
  durable cache would turn into dead links. This also meant no migration.
- Per-claim citations instead of Codex's draft shape (one `summary` plus a `sources` list),
  so every employer-specific sentence carries its own provenance.
- The prep plan (`PrepPlanService`) is not fed by the search. It still plans from sourced
  stages plus the archetype pattern.

## What I could NOT verify
- **No live Gemini call was made (rule 7).** Untested against the real API:
  - the quality of the grounded answers
  - whether the `googleSearch` tool behaves the same on every model in the chain
  - whether `groundingSupports` lines up with whole sentences
  - real latency

  This is the kind of change only a live check catches. A handful of grounded calls, for
  1–2 known and 1–2 obscure employers, would settle it.
- **Google's terms for Grounding with Google Search** require showing the "Search
  Suggestions" chip (`groundingMetadata.searchEntryPoint.renderedContent`, Google-supplied
  HTML) wherever grounded results are displayed. I did not render it: it means injecting
  third-party HTML, and whether it is required for this use is a legal call. **This needs
  your decision before this ships to real users.**
- Cost: grounded searches are billed per query, separately from tokens. `AiPrices` records
  only tokens, so the spend ledger will under-count this call.
- Visual design of the new section (amber card, superscript citations).

## Verification status
- Backend `ktlintCheck test build`: pass, `BUILD SUCCESSFUL`.
- Frontend typecheck: pass. Lint: pass (was failing on CI before this run).
- Frontend tests: pass, 57 files / 2,921 tests. Production build: pass, 174 pages.
- GitHub CI run `36964102931` on `b2a1757`: web and API jobs both green.
- No dependency, secret, schema, or migration changes.

## Merge status
- PR #22 (https://github.com/namankau/AIInterviewer/pull/22) into `develop`, left open for
  human review as task 065 requires (it touches user-data isolation). Not merged; `main`
  was not touched.

## Suggested next task
- Make a short, approved set of live grounded calls, and decide on the Search Suggestions
  display before enabling `INTERVIEWOS_PUBLIC_LOOP_RESEARCH` in production.

## Open questions for you
- Must we render Google's Search Suggestions chip? If not, should the feature stay off
  (`INTERVIEWOS_PUBLIC_LOOP_RESEARCH=false`) until legal posture is settled?
