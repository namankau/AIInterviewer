# Task 055 — The Arena: make learning a game, not a reading assignment

## The owner's ask

> "Add a gaming sort of section as well like scalequest.io has, which makes learning
> interactive and interesting for new users. Introduce this. Don't reinvent the wheel but
> leverage open source things."

Courses now have visuals (047, 052, 054) and a playground (049). What they still are is
**something you read**. A student revising at 11pm before a campus drive does not want a
chapter; they want short, sharp rounds that tell them in ten seconds whether they actually
know this, and give them a reason to come back tomorrow.

That is what this task builds: `/arena`.

---

## What scalequest.io actually is — and what to take from it

A research pass looked at the live site, because the reference matters. **It is not a
quiz bank with XP bolted on**, which is the obvious thing to build and the wrong thing:

- It is a **narrative, scenario-driven game**. You read a short crisis story with named
  characters, you look at a **diagram of the system**, you make one architectural call, and
  you are told immediately whether the decision was sound and why.
- Progression runs through **four themed campaigns of rising difficulty**, each built around
  a concrete scenario, rather than abstract topic buckets. Checkpointed, unlocking as you go.
- The mechanics underneath are still just multiple choice with feedback. **What makes it feel
  like a game is the framing — story plus diagram wrapped around each decision — not the
  scoring.**

The lesson, and it is the most important sentence in this brief: **the gamification is
presentation, not arithmetic.** A leaderboard and an XP number will not make this fun. A
decision that feels like it matters, shown as a picture, will.

Two consequences for what you build:

1. **Campaigns, not one flat pool.** The courses already have a module structure — use it.
   Each module is a campaign with a name and a theme; its chapters are the levels; difficulty
   rises through it; progress is checkpointed per campaign. This is nearly free, because the
   structure exists, and it is the half of scalequest's shape that carries most of the feel.
2. **Lead with the picture.** Where a challenge has a `viz` available, show the diagram and
   ask for the decision, rather than showing a paragraph and asking about it. Reuse
   `viz-block.tsx`; do not build a second visualisation system.

**What is explicitly out of scope here:** authored crisis narratives with characters, and
system-design scenarios. Our courses are Java and DSA, and CLAUDE.md settles that system
design is refused for a campus fresher — so scalequest's actual subject matter is not ours to
copy. Written narrative content is a separate content-authoring task if the owner wants it.
Build the structure and the framing; do not invent story content to fill it.

---

## The core architectural rule — read this before anything else

**The Arena does not get its own content store. Challenges are derived from the course
content that already exists, by a pure function, at build time.**

We already own a reviewed corpus that most products building this would have to buy or
scrape:

| Existing block | Count | Becomes |
|---|---|---|
| `quiz` | 195 | The MCQ challenge, directly |
| `code` with a real pasted `output` | 26 | **"Predict the output"** — the answer is already verified real program output |
| `pitfall` | 66 blocks | **"Spot the mistake"** — each item is already a mistake-and-fix pair |
| `viz` frames | 65 | **"What happens next?"** — show frame N, ask for the note on frame N+1 |
| `compare` columns | 8 | **"Which column?"** — sort items into the right side |
| `playground` | 7 | **"Make it print this"** — an objective already exists in `expectedOutput` |

Write `lib/arena/derive.ts`: pure, synchronous, no I/O, takes `courses` and returns
`Challenge[]`. Every challenge carries `{ courseSlug, chapterSlug, moduleTitle }` so it can
link back to where it is taught, and a stable deterministic `id` derived from its source
location and content (**not** an array index — inserting a chapter must not renumber
everyone's saved progress).

Why this is non-negotiable:
- **It cannot drift.** A chapter fix updates the game the same day.
- **Nothing is duplicated**, so nothing has to be kept in sync by hand.
- **The content is already reviewed** for accuracy — the hard part is done.
- A derived corpus means the game gets bigger for free every time a chapter is written.

**Do not hand-author a parallel question bank.** If a challenge kind cannot be derived
cleanly, drop that kind and say why in your report. A smaller Arena built on real content
beats a bigger one built on invented content.

Distractors for derived kinds must come from real material (other frame notes in the same
viz, other outputs in the same chapter, the "wrong" half of a pitfall pair). **Never invent a
plausible-looking wrong answer that is secretly also right** — that is the one bug that makes
a learning game actively harmful. Where a kind cannot produce honest distractors, make it a
free-text or ordering challenge instead of MCQ.

---

## Scope

### 1. A session that feels like a game

A run is **short** — around 7 challenges, 3–5 minutes, a clear end. Not an endless list.

- One challenge on screen at a time, big, using the width. Not a scrolling quiz form.
- Immediate feedback with the *reason* (every derived kind has one — `why`, the pitfall fix,
  the frame note), plus a link to the chapter that teaches it.
- A visible run of correct answers within the session, and a result screen at the end that
  says what to revise, linking to specific chapters.
- Keyboard-first: number keys select, Enter confirms, and it must be fully operable without
  a mouse. This is also the accessibility requirement, not a power-user nicety.

### 2. Progression that is honest

- **XP and levels**, with the curve in one named constant, not scattered magic numbers.
- **A daily streak.** Day boundaries in the user's local timezone. Write a test for the
  timezone edge — a streak that breaks at 5:30am IST because somebody used UTC is the exact
  bug that makes a user stop trusting the product.
- **Badges** for real milestones (a module completed, a chapter's challenges all correct,
  a 7-day streak). **Every badge must correspond to something actually achieved.** No
  participation trophies for opening the page.
- **A daily quest** — a fixed set for the calendar day, the same for everyone, seeded
  deterministically from the date so it is stable across a refresh and across devices.

### 3. Spaced repetition — the one place to take a dependency

Which challenge a learner sees next is the genuinely hard algorithm here, and it is solved.
A research pass verified the options; **its conclusion is settled, implement it, do not
relitigate it**:

- **Adopt `ts-fsrs` (MIT, ~7.2KB gzipped, zero runtime dependencies, TypeScript-native,
  client-side).** It is the reference TS implementation of FSRS — the algorithm that
  replaced SM-2 inside Anki itself. Licence confirmed by reading the actual LICENSE file.
- Rejected: `supermemo`, `@dtjv/sm-2`, `@kirklin/supermemo2` — all implement the older SM-2
  that FSRS was built to supersede. Hand-rolling SM-2 was rejected for the same reason: FSRS
  is empirically tuned against large review datasets and is not worth re-deriving.

Wrap it behind `lib/arena/scheduler.ts` so the choice is reversible and so the progression
logic is testable without the library in the loop. You own persistence — `ts-fsrs` is a pure
scheduling function over a card's review history and stores nothing itself.

**Second and last permitted dependency: `canvas-confetti` (ISC, ~4.3KB gzipped, zero deps)**
for the celebration on a genuine milestone. It has a `disableForReducedMotion` option but it
is **off by default** — wrap it in a helper that checks the media query and pass the flag.
Do not fire it on every correct answer; a celebration that happens constantly is noise.

**These two are the entire dependency budget for this task.** Anything else needs a written
justification in your report against what is already in the repo.

### 4. Where it lives

- Route `/arena` (naming is settled — do not bikeshed it), plus `/arena/[course]` to practise
  one course. Server-render the landing page: it is a public, free, indexable surface, same
  as the courses.
- Add it to `rail-nav.tsx` (`components/rail-nav.tsx`, the `LINKS` array).
- On a chapter page, a small "practise this chapter" entry point.
- On the landing page and the course index, a card — this is an acquisition surface.

### 5. It must work logged out

Courses are public and free, and this is the most shareable thing on the site. A student who
lands from search must be able to play immediately, with no account.

- **Progress lives in `localStorage` for this task**, behind `lib/arena/storage.ts` with a
  versioned schema key and a safe migration path.
- **Wrap every read and write in try/catch** and render correctly when it throws or returns
  nothing — private windows and blocked site data are real.
- Do **not** build account sync, a leaderboard, or any server persistence here. That is task
  056, it touches user data and RLS, and it goes through a PR rather than a direct merge.
  Just keep the storage module's interface clean enough that a server-backed implementation
  can replace it later.

---

## Don't reinvent the wheel — and don't over-install either

The owner has said this twice, so be deliberate in both directions. The research pass has
already done this work — install `ts-fsrs` and `canvas-confetti`, and **build everything else
by hand**. Its other findings, so you do not repeat the search:

- **No permissively-licensed question corpus exists** that this product may use. Checked and
  rejected: `open-quiz-commons` (CC-BY-SA-4.0 — ShareAlike would infect our content),
  `sachuverma/DataStructures-Algorithms` (MIT on the repo, but the content is just *links* to
  GeeksforGeeks/LeetCode/InterviewBit, which we may neither scrape nor republish), and the
  general run of "CS-Fundamentals" student repos (no LICENSE file at all, therefore default
  copyright). This independently confirms the earlier DSA-corpus finding. **The 195 reviewed
  questions already in the repo are the only sound source.** This is exactly why the derived
  corpus above is the architecture.
- **XP curves, streak tracking and badge definitions have no library worth taking** — each is
  50–100 lines against our own data model, and adopting one means bending our schema to fit
  someone else's. Write them.
- `Trophy UI` (gamification UI components) came back **licence-unverified — the repo 404'd**.
  Do not install it. Recorded only so nobody re-searches it.

Broad priors that still hold:

- **Do not** add a charting, animation, or state-management library. `useReducer` is enough.
  CLAUDE.md explicitly bans a state-management library before there is state that needs one.
- **Do not** build a second visualisation system. `viz-block.tsx` renders frames already —
  reuse the component for the "what happens next" challenge.
- Reuse `report-charts.tsx` patterns for any progress ring rather than starting over.
- Any dependency you add must be justified in your report against what is already present,
  with licence and bundle impact, and must not land in the client bundle of the *course*
  route (the Arena's cost is the Arena's own).

---

## Hard constraints

- **Never invent teaching content.** Everything shown is derived from reviewed chapters.
- **Never encode meaning in colour alone** — pair with a label, icon or position. Correct and
  incorrect must be distinguishable by a screen reader and by a colour-blind reader.
- **Respect `prefers-reduced-motion`.** `use-prefers-reduced-motion.ts` already exists — use
  it. Any celebration animation is off by default under that setting.
- Design tokens only, and dark mode must work. The 15 Sep 2026 direction: white and soft-blue
  surfaces, deep navy, one saturated primary blue, green for success, amber for highlights.
- **No emoji as iconography.** Draw in SVG.
- No dark patterns. No fake urgency, no invented counts of other users, no "you'll lose your
  streak!" guilt copy. A number must be true or it does not appear.
- Do not touch `apps/api/`, the report, or the interview flow.
- Do not regress 047's visuals, 049's playground, 050's language toggle, or 052's layout.
- Never weaken, skip, or ignore a test to get green.

## Tests

- `derive.ts` gets real unit tests over the **actual course content**, not fixtures: every
  derived challenge has a correct answer that exists in its options, no duplicate options,
  no challenge whose distractors are also correct, and every `chapterSlug` resolves.
- A test pinning the **minimum** number of derived challenges, so a content refactor that
  silently empties the Arena fails the build.
- Determinism: the same date seeds the same daily quest; challenge ids are stable across runs.
- Streak arithmetic across a local-midnight boundary and across a timezone change.
- Storage: corrupt JSON, absent key, and a throwing `localStorage` all degrade gracefully.
- Accessibility and behaviour, not snapshots: keyboard operation end to end, feedback
  announced to assistive tech, focus managed between challenges.

## Split the work

This is large. Commit and push after each coherent step — agents on this run have been killed
by usage limits and network drops, and the ones that pushed after every step lost nothing.
Suggested order, each its own commit:

1. `derive.ts` + its tests, with no UI at all. **Get the corpus right first** — everything
   else is worthless if the questions are wrong.
2. Scheduler + storage + progression (XP, streak, badges), still headless, fully tested.
3. The session UI.
4. The `/arena` landing and course pages, entry points, nav.

If you run short, a clean partial covering steps 1–2 plus a minimal UI beats a rushed sweep.
Say clearly what is done and what is not.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. **Do not merge** — the orchestrator merges on green CI.

**Report what a human must look at**, and be specific about which widths and which states
(empty, mid-run, result screen, dark mode). CI cannot judge whether this feels like a game.
