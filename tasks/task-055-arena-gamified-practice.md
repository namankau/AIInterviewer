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

Which challenge a learner sees next is the genuinely hard algorithm here, and it is a solved
problem. A separate research pass is running on this; its recommendation will be sent to you
before you need it. **Follow it.** If it says adopt `ts-fsrs`, adopt it rather than
hand-rolling SM-2. If it says hand-roll, hand-roll.

Wrap whatever you use behind `lib/arena/scheduler.ts` so the choice is reversible and
testable without the library in the loop.

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

The owner has said this twice, so be deliberate in both directions. The research pass will
give you a verified list of what to install and what to build by hand. Broad priors:

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
