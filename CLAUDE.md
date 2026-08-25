# CLAUDE.md

Project context for Claude Code. Read this before doing anything else.

---

## What this project is

A voice-first AI mock interview platform. A candidate uploads their resume, then for
each session picks the company and role they want to be interviewed for, and takes a
realistic spoken mock interview conducted by an adaptive AI interviewer. Afterwards
they get a structured, evidence-backed feedback report.

**The differentiator** is coverage and realism, not question volume. Product
companies (Google, Amazon, Microsoft and similar) are fully in scope and must be
first-class — but so are service-based IT firms (TCS, Infosys, Deloitte, Accenture),
European employers, and non-engineering corporate functions, plus Hindi-English
code-switched interviews. Competing tools cover only the first group. We cover all of
them without being worse at the group everyone else already serves.

Full requirements: `docs/PRD.pdf`. Reference PRD section numbers in commits and PRs
rather than restating requirements.

---

## Ground rules

1. **Work on a branch, then merge into `develop` yourself. Never touch `main`.**
   Branch as `feat/<short-slug>` or `fix/<short-slug>`, then merge into `develop`
   once the verification loop is green. `develop` is the owner's running environment;
   `main` is release-only and is human-merged.

   **The merge is gated on green CI, not on your judgement.** If typecheck, lint,
   tests, or build fail, do not merge — leave the branch, push it, and say so in
   `HANDOFF.md`. A red merge into `develop` breaks the owner's environment and costs
   more time than the run saved.

   **Open a PR instead of merging** when the change touches auth, payments, data
   deletion, permissions, or anything listed under "Things that need a human".
2. **Leave a `HANDOFF.md` at repo root at the end of every autonomous run.** See the
   template at the bottom of this file. This is the human's morning read.
3. **Never commit secrets.** No API keys, tokens, connection strings, or `.env`
   contents in tracked files. If a task needs a new secret, add the key name to
   `.env.example` with an empty value and note it in `HANDOFF.md`.
4. **If the task is ambiguous, pick the interpretation most consistent with the PRD,
   implement it, and record the assumption in `HANDOFF.md`.** Do not stall waiting
   for input — these runs are unattended.
5. **Do not scaffold features outside the current task.** Scope creep in an
   unattended run produces code nobody reviews. One task, done properly, with tests.
6. **Do not add dependencies casually.** Prefer the standard library or an existing
   dependency. If a new one is genuinely needed, justify it in `HANDOFF.md`.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | SSR matters — organic search on "<employer> interview" queries is a primary acquisition channel |
| Styling | Tailwind + headless component primitives | No heavyweight component framework |
| Backend | Spring Boot (Kotlin) | Chosen to match the owner's expertise; this is deliberate, do not propose migrating |
| Database | PostgreSQL + pgvector | Single store for relational and vector workloads at this scale |
| Platform | Supabase (auth, storage, Postgres) | Google OAuth via Supabase Auth |
| Voice transport | LiveKit or Pipecat (decision pending) | Must have mature Android + iOS SDKs — Phase 3 depends on it |
| Payments | Razorpay (India), Stripe (international) | Not needed until Phase 1 |

**Do not introduce:** a separate vector database, a second backend language, a state
management library before there is state that needs managing, or a component library
that fights Tailwind.

---

## Repository layout

```
/apps/web          Next.js frontend
/apps/api          Spring Boot backend
/packages/shared   Shared TypeScript types (generated from API schema)
/docs              PRD and design notes
/tasks             Task files for autonomous runs
/runs              Run logs (gitignored)
HANDOFF.md         Written fresh by each autonomous run
```

---

## Architectural rules

These exist because a native mobile app is a stated Phase 3 goal. Violating them
makes that port expensive.

- **Interview context is chosen per session, not stored as a persistent target
  list.** The candidate picks company + role at the start of each session. There is
  no cap on how many companies they may practise for, and no setup step that asks
  them to declare targets in advance. Each session is scoped to exactly one company
  and one role so its question set, rubric, and round structure stay coherent.
- **Progress is derived, not declared.** History is grouped by (company, role) after
  the fact from completed sessions. Do not build a "my targets" entity — if a
  progress view needs grouping, aggregate over past sessions.
- **All interview logic is server-side.** Composition, retrieval, scoring, and
  persona behaviour live in the backend. The client is thin. Never put question
  selection or scoring logic in the frontend.
- **The web app consumes the same versioned public API the mobile apps will.** No
  server-rendered coupling in session, report, or profile flows.
- **Provenance is a first-class field, not a nice-to-have.** Every piece of retrieved
  interview knowledge carries its tier (`model_knowledge`, `published_source`,
  `community_reported`), recency, and corroboration count. These surface to the user.
  Never let a general pattern be presented as a specific report.
- **Never fabricate employer-specific detail.** If retrieval returns nothing for a
  named employer, fall back to archetype-level patterns and say so explicitly. A
  confidently invented claim about a real company's process is the single most
  damaging failure mode this product has.

---

## Data handling

Resumes, interview audio, and transcripts are personal data. Treat them accordingly.

- Recording requires explicit user consent captured before the session starts.
- Every user-data table needs a clear owner column and row-level security.
- Account deletion must actually delete, including storage objects.
- Community-contributed interview reports are anonymised before they enter the
  shared corpus — never store them in a form that can be traced to a user.
- **Do not write scrapers.** Bulk scraping of LeetCode, Blind, Reddit, Glassdoor,
  AmbitionBox, or GeeksforGeeks discussion content is out of scope by decision, not
  oversight. If a task seems to require it, stop and flag it in `HANDOFF.md`.

---

## Verification loop

Run these before opening a PR. A run that ends with a red build is a failed run —
keep iterating until they pass or until you have exhausted reasonable attempts, then
report the failure honestly in `HANDOFF.md` rather than disabling the check.

```bash
# frontend
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build

# backend
cd apps/api && ./gradlew ktlintCheck test build
```

**Never** make a test pass by weakening the assertion, skipping the test, or adding
an ignore directive. If a test is genuinely wrong, fix it and explain why in the PR.

---

## Testing expectations

- Business logic (scoring, session composition, retrieval filtering) needs unit tests.
- API endpoints need at least one integration test covering the happy path and one
  auth-failure path.
- UI: test behaviour and accessibility, not snapshots.
- No test that depends on a live third-party API. Mock at the boundary.

---

## Design direction

The user is a nervous candidate preparing for something that affects their
livelihood. The interface should feel calm, serious, and professional — closer to a
tool than a consumer app.

- One primary action per screen. The dashboard's job is to start the next interview.
- The live session screen is deliberately near-empty: speaking indicator, timer,
  round label, exit. No score tickers, no live hints, no gamification.
- Typography-led, generously spaced, single restrained accent colour.
- Reports are where visual richness belongs.
- Mobile-responsive from day one. Accessible by default: transcript alongside audio,
  keyboard navigation, adequate contrast.

---

## Commit and PR conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Reference the PRD section: `feat: resume upload and parse flow (PRD §05)`.
- PR description states what changed, what was assumed, and what was not verified.
- Keep PRs reviewable. If a task produces more than roughly 800 changed lines,
  consider whether it should have been split, and say so in `HANDOFF.md`.

---

## HANDOFF.md template

Overwrite this file at the end of every run.

```markdown
# Handoff — <date>

## Task
<one line, and the task file path>

## What I built
- <bullets, with file paths>

## Assumptions I made
- <every ambiguity resolved, and how — be specific>

## What I could NOT verify
- <anything needing human judgement: visual design, latency, voice quality,
   third-party integration behaviour, anything requiring credentials I don't have>

## Verification status
- typecheck / lint / tests / build: <pass or fail, with detail on failures>

## Merge status
- <merged into `develop` at <sha>, OR branch `<name>` pushed unmerged because <reason>,
   OR PR #<n> opened because the change touches a human-review area>

## Suggested next task
- <one line>

## Open questions for you
- <only genuine blockers — keep this short>
```

---

## Things that need a human, not an agent

Do not attempt these autonomously. Flag them and move on:

- Judging whether the interviewer persona sounds realistic or the latency feels right.
- Choosing between voice vendors, or anything that commits real spend.
- Final visual design direction.
- Anything involving production credentials, App Store / Play Store accounts, or
  legal/data-protection posture.
- Adding a new function vertical (CA, consulting, automobile) — each needs a rubric
  and persona built with domain input first.
