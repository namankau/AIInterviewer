# Task 002 — The first complete interview loop

**Run type:** unattended overnight
**Target branch:** `feat/002-interview-loop` → merge into `develop` when green
**PRD reference:** §05 (profile), §06 (engine), §09 (feedback and scoring), §13 (mobile-readiness)

Read `CLAUDE.md` first. Everything in it applies, including that `develop` is the only
branch you push to. This file describes what to build tonight.

---

## Goal

A candidate who has never used the product signs in, is ready to interview within four
minutes, takes a complete text-based mock interview, and gets a report that quotes what
they actually said. They can schedule a future session and see their readiness change
across attempts.

The interview is **text-based this run**. Voice is a later phase. Compose, conduct and
score entirely server-side so the transport can be swapped without touching the logic.

Success means: a stranger can be given the URL, and get through onboarding → interview →
report without being told what to do.

---

## Decisions already made — do not relitigate

These are settled. Implement them; do not spend the run reconsidering.

1. **Text interview, spoken-style.** One question at a time, typed answers, a visible
   timer and round label. The session screen stays near-empty per the design direction:
   no score ticker, no live hints.
2. **Adaptive if a key is present, deterministic if not.** If `ANTHROPIC_API_KEY` is
   set, the engine uses it for follow-up selection and scoring. If it is absent, the
   engine falls back to a deterministic difficulty ladder over the seeded question bank
   and rubric-based scoring. **Both paths must work.** The app must never crash or
   render a dead screen because a key is missing, and the UI must say which mode
   produced a report.
3. **Question bank is archetype-level, never employer-specific.** Seed questions per
   (archetype, function, round type, difficulty). Every item carries `provenance_tier`
   = `model_knowledge` and surfaces as a general pattern. Inventing a specific claim
   about a real employer's process is the worst failure this product has — if
   retrieval has nothing for a named company, fall back to the archetype and say so in
   the UI.
4. **Notifications go through an outbox, not a direct send.** Write rows to a
   `notifications` table with a scheduled send time and a status. A dispatcher reads
   the outbox. Transport is an interface with a logging implementation as the default.
   Email and WhatsApp adapters are configuration, not code changes — see "Blocked".
5. **Readiness is derived, never stored as a target.** Aggregate completed sessions by
   (company, role). Do not create a targets entity — see PRD §05 and the schema comment.
6. **Keep the design language from task 001.** Tokens in `globals.css`, one accent, one
   primary action per screen. Reports are where visual richness belongs.

---

## Scope

### 1. Onboarding — get to a first interview fast

- Profile step: function, current level, target level, total experience, preferred
  language. Everything else deferred and asked contextually later.
- Resume upload to Supabase Storage, private bucket, RLS so a candidate can only reach
  their own object. Extract raw text server-side and show it back for confirmation.
  **Structured field extraction is not required tonight** — store the text, keep
  `parse_status` honest.
- The dashboard's single primary action stays "start an interview".

### 2. Session setup and the interview itself

- Candidate names company and role at the start of a session, picks a round type, and
  begins. Resolve the company to an archetype server-side; when it is unrecognised,
  say which archetype was assumed rather than guessing specifics.
- Turn-by-turn: question, typed answer, next turn chosen by the engine. Persist every
  turn as it happens so a refresh or a dropped connection does not lose the session.
- Exit mid-session leaves the session `abandoned`, not deleted.

### 3. Scoring and the report (PRD §09)

The report is where perceived value concentrates. A generic encouraging summary destroys
credibility. Required contents:

- Competency scores against the function and level rubric, **each justified by a quoted
  moment from the candidate's own transcript**.
- Answer-level annotations: what worked, what was vague, what a real interviewer would
  have probed.
- A targeted practice plan and the next recommended session type.
- An outcome judgement, clearly framed as a simulation.

### 4. Readiness view

Group completed sessions by (company, role). Show competency movement across attempts
and recurring weaknesses. This is the retention surface — it must read as evidence, not
as a score badge.

### 5. Scheduling and reminders

- Schedule a session for a future date and time; it appears on the dashboard.
- On scheduling, enqueue reminder rows in the outbox (24h before and 1h before).
- The dispatcher runs on a schedule, marks rows sent or failed, and retries with
  backoff. With no provider configured it logs and marks `skipped_no_transport` —
  that is a valid, tested outcome, not a failure.

### 6. Tests

Per `CLAUDE.md`: unit tests for composition, scoring and readiness aggregation; at least
one happy-path and one auth-failure integration test per endpoint; UI tests for
behaviour and accessibility. No test may depend on a live third-party API — mock at the
boundary, including the LLM.

---

## Blocked — do not attempt, note in `HANDOFF.md`

These need credentials or approvals that no amount of implementation effort replaces.
Build the seams; leave the wiring.

- **WhatsApp reminders.** Requires a WhatsApp Business account, business verification,
  and per-template approval from Meta. Approval alone takes longer than this run. Build
  the adapter interface and leave it unimplemented.
- **Email delivery.** Requires a provider account and a verified sending domain. Add
  the key names to `.env.example`, implement one adapter behind the interface, and
  leave it unconfigured.
- **Anything committing spend, or any production credential.** Same rule as always.

---

## Out of scope tonight

Voice or WebRTC of any kind. Community-contributed reports and the contribution flow.
Payments. Scrapers of any kind — still out of scope by decision, not oversight. Any new
function vertical beyond Wave 1 (backend/full-stack, QA and automation, data and AI
engineering); each needs a rubric built with domain input first.

---

## Definition of done

- [ ] A signed-in candidate can complete onboarding, an interview, and reach a report
      with no instruction
- [ ] The full loop works with `ANTHROPIC_API_KEY` unset, and improves when it is set
- [ ] Every competency score in a report cites a quote from that transcript
- [ ] Readiness groups completed sessions by company and role, derived not stored
- [ ] Reminders are enqueued on scheduling and the dispatcher drains the outbox
- [ ] No employer-specific claim is ever rendered without a provenance label
- [ ] RLS on every new table; storage objects reachable only by their owner
- [ ] Typecheck, lint, tests and build pass for both apps
- [ ] **CI is green and you have seen it** — `gh run watch`. If you cannot see it, you
      have not passed the gate; say so and do not merge
- [ ] `HANDOFF.md` written per the template in `CLAUDE.md`
- [ ] Merged into `develop`, or the branch pushed unmerged with the reason stated

---

## Notes for the run

- Prefer boring choices. `gh` is installed and authenticated; use it to verify CI rather
  than assuming.
- If the run is going to overrun, **ship the interview loop end to end and drop
  scheduling and reminders.** A complete loop that works beats six half-features. Say
  what you dropped in `HANDOFF.md`.
- Keep PRs reviewable. Task 001 ran to ~3,000 lines in one commit, which was too large;
  split this one along the numbered sections above.
- Migrations are owned by the Supabase CLI in `supabase/migrations`. Never edit an
  applied migration — add a new one. Verify with `npm run db:push` against the linked
  project.
