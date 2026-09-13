# Task 037 — Before the round: how this company interviews, a plan, then any round

PRD §08 (employer profile: *"typical loop structure, round sequence, evaluation
emphases"*), §10 (session setup: *"expected loop preview"*), §09 (targeted practice
plan), §05 (no stored target list). Part of the overnight run: read
[`overnight-2026-09-14.md`](overnight-2026-09-14.md) first. **Starts after task 035 is
merged** — build on its `CompanyDirectory`, companies table and bank.

## What the owner asked for

> When user says they're preparing for certain role, before direct interview thing, give
> them a layout how the interviews for certain roles happen in that certain company and
> then layout a plan, and then give them option for the mock interview of any kind they
> want.

## The rule that shapes the design

Never fabricate employer-specific detail. A model asked "how does Amazon interview SDEs?"
answers fluently and partly wrongly, and a page would present that as fact. So the design
makes invention structurally hard instead of prompting against it:

- **What we say about the company comes only from sources** — process stages extracted
  from documents, each with a verbatim evidence quote the engine checks is really in the
  document.
- **What the model contributes is archetype-level, and it is never given the company's
  name while writing it.** It describes how loops at global product companies usually run
  for a backend engineer at this level. It cannot invent an Amazon-specific detail if it
  is not writing about Amazon.
- The page shows both, side by side, labelled: "From Amazon's own careers site", "From a
  published account by <author>, 2024", "Usual for global product company loops — not a
  claim about Amazon".

## Build

### 1. Process stages from sources

- Extend the extractor — the same call as questions, so each document is read once — to
  return `processStages`: for each stage the document describes at a named employer, the
  companies, role family, order, the stage's name as the document gives it ("Online
  assessment", "Bar raiser"), format, duration if stated, what it assesses, the round type
  it maps to (the existing enum, or null for stages we do not simulate: online assessment,
  team matching, offer), and `evidence` — a verbatim quote of at most about 300 characters.
- **Engine check:** the evidence must occur in the fetched text (whitespace-normalised).
  If it does not, the stage is dropped. This is what stops extraction itself inventing
  process detail. Unit-test it.
- Table `source_process_stages` in `20260914020000_loop_brief.sql` (additive; `source_id`
  cascades; company through 035's `companies`). Bump `EXTRACTOR_VERSION` so existing
  sources are re-read.

### 2. The loop brief — `GET /api/v1/loop-brief?company=&role=&level=`

- Company through `CompanyDirectory`, archetype through `ArchetypeResolver`.
- **Sourced stages** — from `source_process_stages` for that company (role-filtered where
  the data allows), merged across sources (the same stage from two sources is one stage
  with two citations), in order. Tier `published_source`; citations with origin.
- **General pattern** — model-written (new prompt and schema, the default cheap model)
  from archetype, role and level, **without the company name**. Cache it per (archetype,
  normalised role, level band) in a table: it is neither personal nor about the company, so
  caching is sound and brings its cost close to nothing. Each stage maps to an offered
  round type or null.
- **Bank coverage** — 035's per-round-type counts for this company, with a link to
  `/questions/<slug>`.
- Integration tests: happy path and unauthenticated 401.

### 3. The plan — `GET /api/v1/prep-plan?company=&role=&level=`

A separate endpoint, so the brief renders without waiting for it.

- Inputs: the brief; the candidate's resume (`ResumeService.backgroundFor`); and their
  history for this exact company and role, derived from completed sessions and reports
  (PRD §05: progress is derived, not declared — see `ReadinessService`).
- Output: an ordered list of practice rounds — **offered round types only**
  (`interviewos.rounds.offered`) — each with why (tied to a loop stage, and to the resume or
  past reports where they actually say something), two or three focus areas, and a
  suggested length; plus the stages we do not simulate and what to do about them.
- **Not persisted.** No plan table, no target entity — computed on request (`CLAUDE.md`,
  PRD §05). A model failure falls back to a deterministic plan (loop order mapped to round
  types) rather than a broken page.
- Tests: round types outside the offered set are dropped; an unsourced claim cannot carry
  a citation; the fallback; the endpoint (happy path, 401).

### 4. The web flow — `/interview/new`

1. **"What are you walking into?"** — unchanged: the composer, or company and role.
2. **New: "How <Company> interviews for <Role>".** The loop as an ordered sequence —
   editorial and typographic, not a grid of cards — each stage labelled with its
   provenance; the bank line ("23 sourced questions for Amazon — see them"); the plan.
   Primary action: start the plan's first round. Every other offered round is one click
   away — "any kind they want" is literal. A way past this screen for someone who already
   knows the loop.
3. **The existing setup** (duration, language, consent), with the chosen round filled in.

- Sourced stages and coverage render first; the general pattern and plan fill in.
- An honest empty state: no sources for the company → the page says so plainly and shows
  the general pattern for its archetype.
- Behaviour and accessibility tests; phone width; `CLAUDE.md`'s quality bar — read "Design
  direction" again before writing JSX.

## Not in this task

How questions are chosen inside the round (038). Loops as a stored, multi-round entity —
task 030 deferred it deliberately and `CLAUDE.md` forbids a targets entity. Interview
dates or reminders.

## Done when

Extraction writes checked stages; the brief and plan endpoints are tested; the setup flow
is built and tested; CI is green on `feat/loop-brief`; the final report follows the
overnight rules.
