# Handoff — 2026-09-21 (second run of the day)

## Task
Add a gamified, interactive learning section "like scalequest.io", leveraging open source
rather than reinventing it. `tasks/task-055-arena-gamified-practice.md`.

---

## The research changed the design — read this first

I had a researcher look at scalequest.io rather than assume what it was. **It is not a quiz
bank with XP bolted on**, which is the obvious thing to build and the wrong thing:

- You read a short crisis narrative, you look at a **diagram of the system**, you make one
  architectural call, and you are told immediately whether it was sound.
- Progression runs through four **themed campaigns of rising difficulty**, checkpointed.
- The mechanics underneath are plain multiple choice. **What makes it a game is the framing
  — story plus diagram around each decision — not the scoring.**

So the Arena leads with the picture where a chapter has one, and it does **not** copy
scalequest's subject matter: its content is system design, which CLAUDE.md already settles is
refused for a campus fresher. Authored story content is a content task, not this one.

## What I built

**`/arena`** — short, keyboard-first practice runs, public, free, and playable with no
account.

**The architecture that matters: the Arena has no content store of its own.**
`lib/arena/derive.ts` is a pure function from `courses` to `Challenge[]` — no I/O, no clock,
no `Math.random`. It derives **~800 challenges from the 65 chapters that already exist**:

| Kind | Count | Derived from |
|---|---|---|
| `mcq` | 195 | the existing `quiz` blocks, directly |
| `what-next` | ~253 | a `viz` frame — "what does the next step say?" |
| `spot-mistake` | ~239 | the mistake/fix pairs already inside `pitfall` blocks |
| `predict-output` | ~74 | `code`/`playground` blocks with real pasted output |
| `which-column` | ~41 | `compare` blocks |

That corpus was already reviewed for accuracy, it **cannot drift** from the courses, and it
grows every time a chapter is written. `derive.test.ts` pins a floor of 700 so a content
refactor cannot silently empty the Arena.

**Distractors are never invented.** They are only ever real strings drawn from the same
content — other frame notes in the same visualisation, other real outputs in the same course,
the other half of a pitfall pair. When the pool cannot honestly supply one, the challenge is
**dropped**. That rule is the difference between a learning tool and an actively harmful one:
a plausible wrong answer that is secretly also right teaches the wrong thing.

**The rest, by file:**
- `lib/arena/scheduler.ts` — the only place `ts-fsrs` is imported. Narrows FSRS's four grades
  to two, deliberately: a right/wrong quiz gives no honest signal for "recalled but it was a
  struggle", and guessing would invent precision the interaction does not support.
- `lib/arena/progression.ts` — XP, level curve (`50·n²`), streak, badges, daily quest. All
  hand-rolled, all named constants. **No streak multiplier** — a reward that varies in ways
  the learner cannot see coming is closer to a slot machine than to honest progress.
- `lib/arena/storage.ts` — `localStorage` behind a versioned key, every read and write in
  try/catch.
- `lib/arena/celebrate.ts` — `canvas-confetti`, gated on `prefers-reduced-motion` at the call
  site rather than trusting the library's opt-in flag. Milestones only, never every answer.
- `components/arena/*` — the session, challenge card, progress summary, daily quest.
- Entry points: `rail-nav.tsx`, the course index, a chapter page, the landing page.

## Assumptions I made
- **Campaigns map onto the existing module tree** rather than a new structure — that is the
  half of scalequest's shape that carries most of the feel, and it was nearly free.
- **The daily quest is 7 challenges**, seeded from the date string alone, so it is identical
  across a refresh and across devices.
- **Badges require real coverage**, not counts — "chapter cleared" means every derived
  challenge from that chapter answered correctly. Deliberately hard; no participation
  trophies.
- **A `what-next` distractor is a *later* state of the same algorithm.** Only one is
  literally next, so it is honest, and it tests order of operations rather than wording.
- **Logged out only.** Account sync, server persistence and any leaderboard are out of scope
  here — they touch user data and RLS, so they are their own task and go through a **PR**.

## What I could NOT verify
- **Nothing has been looked at in a browser.** Still no browser automation in this session.
  This is the third run in a row where that is the main gap. **Please look at:** `/arena`
  (empty state, before any progress exists), a run mid-flight, the result screen, and
  `/arena/[course]` — at 1280px, 1440px, 1920px, on mobile, and in dark mode.
- **Nobody has played it.** Whether a 7-challenge run actually feels like a game rather than
  a quiz is exactly the judgement CI cannot make, and it is the whole point of the task.
- Whether `what-next` reads as fun or as tedious at ~253 challenges — it is the largest slice
  of the corpus and the least proven.
- Confetti on a real milestone, and its reduced-motion behaviour.

## Verification status
- typecheck / lint / tests / build: **pass**. CI green on the branch tip `3702248` (`headSha`
  checked against the tip, not "latest green run"), and green again on `develop` at
  `d3d2585` after the merge.
- **No migrations in this task** — confirmed by diffing `supabase/migrations` across the
  whole run. Nothing to `db:push`.
- I ran `npm install` at the repo root after merging, so the two new packages exist on disk
  locally. This is the one class of breakage green CI structurally cannot see — it runs
  `npm ci` from clean — and it bit us with Shiki last run.

## Dependencies
Two, both pre-approved after a research pass read the actual LICENSE file rather than a
README badge:
- **`ts-fsrs` 5.4.2 (MIT, ~7.2KB gzipped, zero runtime deps)** — the reference TypeScript
  implementation of FSRS, the algorithm that replaced SM-2 inside Anki. Scheduling review is
  the one genuinely hard algorithm here. Rejected: `supermemo`, `@dtjv/sm-2`,
  `@kirklin/supermemo2` (all older SM-2), and hand-rolling.
- **`canvas-confetti` 1.9.4 (ISC, ~4.3KB gzipped, zero deps)** plus its `@types`.

Everything else is hand-rolled, per the research: XP curves, streaks and badges have no
library worth taking, and adopting one means bending our schema to someone else's.

## Merge status
- Merged into `develop` at **`d3d2585`**. Nothing pushed to `main`.
- **The merge is 2683 lines, well over the ~800-line reviewability guideline** in CLAUDE.md.
  It should probably have been split into two tasks — engine and UI — and I am recording that
  rather than glossing it.
- PR #9 (`develop` → `main`) is still open and now understates the release by two full rounds.

## Interruptions
`build-arena` was killed by the session usage limit (resets 1:50pm IST) with step 4 in hand —
but step 4 had already been committed and pushed, and its worktree was clean, so **nothing
was lost and no resume was needed**. CI failed on step 3 (`3b2acf2`); the agent fixed it
itself and the branch tip is green.

## Suggested next task
1. **Play it**, and tell me whether it feels like a game. Nothing else I can do substitutes.
2. A dev-only report preview route (~30 lines) — still the cheapest permanent fix to the
   "nobody has looked at it" problem.

## Open questions for you
- **Account sync and a leaderboard** — worth building? A leaderboard needs a privacy decision
  about what a student's name looks like to strangers, which is yours, not mine.
- **Do you want authored narrative content** (scalequest's actual differentiator) on top of
  the campaign structure? That is a content-writing task of real size, not a code one.
- Still open from earlier runs: the Java runner (self-hosted Piston — spend and an
  arbitrary-code-execution surface), one live generation run for the aptitude generator
  (**it has never produced a real question**), and whether 1600px is the right reader ceiling.
