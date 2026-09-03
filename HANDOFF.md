# Handoff — 3 September 2026

## Task

Close the experience gap with **Layrs** (layrs.me), the competitor you pointed at.
Research notes: `docs/competitor-layrs.md`. Plan: `tasks/task-003.md`.

## The short version

Four branches, each verified and merged into `develop` separately, all green on CI.
Then the whole thing driven through a **real Chromium** as a real signed-in candidate,
against live Gemini and the hosted database.

**A turn went from ~24 seconds to 7.0.** That was the number the last handoff called the
single biggest quality problem, and it is now the difference between a form that talks
and something that behaves like a conversation.

## What Layrs actually is, and what I took

A **voice-first AI tutor for engineers** — Bangalore, beta, ₹1,499/mo — that teaches
system design and DSA through spoken lessons with a whiteboard-watching tutor. Mock
interviews are a recent addition to that tutor, not the product. Full notes in
`docs/competitor-layrs.md`; the four things worth copying were:

1. Setup is one sentence, not a form.
2. The room is real-time. Ours cost 24s a turn.
3. Entering a round is gated on a working microphone.
4. Help can be asked for, and it counts against you.

All four are built. Two more of theirs are flagged for you below rather than built.

**What I deliberately did not take:** their accent is a cyan→blue→violet gradient.
`CLAUDE.md` names purple-to-blue gradients as a tell, so I took their warm paper ground,
their hairlines and their serif display face, and kept our single blue accent.

## What I built

### 003 — the interviewer's voice comes off the critical path

- `apps/api/.../interview/QuestionSpeech.kt` — speech is synthesised *after* the
  transaction commits, on a named background executor
  (`config/BackgroundWorkConfig.kt`). The question text returns the moment the
  assessment produces it.
- `session_turns.question_audio_status` (`20260902100000_async_question_speech.sql`) —
  `pending` / `ready` / `unavailable`. A null path alone could not tell "still coming"
  from "not coming", and a turn stuck on `pending` would have the room polling forever.
- `GET /sessions/{id}/turns/{index}`, and `apps/web/src/lib/use-question-audio.ts`,
  which collects the voice while the candidate is already reading.
- The answer's audio and video now upload **alongside** the assessment rather than ahead
  of it, so the candidate waits for the longer of the two rather than their sum.

**A silence bug nothing would have caught:** autoplay with sound is refused until the
document has been interacted with, and arriving in the room is a navigation, not a
gesture. The refusal was being swallowed, so the interviewer never spoke. It now
surfaces a control and says why — and the device check below is the gesture that fixes
it properly.

### 004 — a room you enter, that listens, and that helps if asked

- `apps/web/src/components/device-check.tsx` — the antechamber. Device state, a level
  meter that proves the microphone is live, what the round will do, then a way in. A
  blocked mic closes the door rather than burning the one free interview.
- `apps/web/src/lib/silence.ts` — the answer ends itself. Conservative on purpose:
  nothing starts the clock until they have actually spoken, a pause for thought is not
  an ending, and the button stays for anyone who wants it.
- **Help you can ask for.** `POST /sessions/{id}/turns/{i}/hint`, a new prompt
  (`ai/prompts/offer-hint.md`) that gives the smallest useful push and then judges how
  much it gave away. One per question. The room says what asking costs *before* they
  ask.
- `hint_requested_at` / `hint_text` / `hint_level` are separate from `intervention`
  (`20260903020000_asked_for_hint.sql`) — that column holds what the interviewer
  supplied *in response to* an answer, and writing both to one place would let the
  assessment of an answer overwrite the hint that shaped it. A turn is credited at
  whichever help was more generous.

### 005 — set the round up in one sentence

- `ai/prompts/compose-round.md` + `POST /api/v1/round-drafts`. "Infosys MR round next
  Tuesday, 5 years Java backend, and I always fumble the escalation questions" becomes
  company, role, level, round type, length and language.
- **The draft is always shown back before anything starts**, with everything the model
  filled in listed where the candidate can see it. They get one free round; a setup that
  quietly guessed wrong would waste it.
- The employer is resolved to an archetype **server-side, not by the model**. A model
  that both guessed the company and described its process would be inventing exactly
  what we must never invent — so it reads the sentence and nothing else.
- Degrades to the plain form when the composer fails, and there is a way past it for
  anyone who would rather just type.

### 006 — an app shell, a catalogue, and a page set on paper

- Warm ground (`#fbf8f4`), hairlines at 8% rather than card borders, and headings set in
  a **serif** against the sans interface. That face contrast is most of what separates an
  editorial page from a dashboard.
- `components/app-shell.tsx` — a left rail. Not applied to the interview room: a nav
  beside a live interview is an invitation to leave it.
- **`/rounds`** — the catalogue, server-rendered for organic search (PRD 11). Eight
  rounds, each naming real employers and saying what an interviewer is *listening for*.
  This is the page that makes the coverage argument: TCS NQT, Deloitte case rounds,
  Booking.com competency rounds and the HR conversation about notice and relocation, none
  of which Layrs touches.

### The browser harness — `scripts/e2e/`

Plus `scripts/test-user.mjs`, which mints a confirmed password account through the admin
API so the app can be driven without a Google OAuth round trip. Sign-in is still
Google-only for real candidates.

## Verified, in a real browser

`scripts/e2e/interview.mjs` against merged `develop`, live Gemini, hosted database.
Chromium was fed a real spoken answer (rendered by Gemini TTS) as its microphone, so the
transcript came from actual speech.

| | |
|---|---|
| Composer read "Infosys project deep-dive next week. 6 years, payments and ledger systems." | Infosys · Senior Software Engineer · project deep-dive |
| Composed in | 5.5 s |
| Session created in | 5.2 s |
| Device check, camera preview under consent | pass |
| Question audio: signed URL, **decoded by the browser** | 21.0 s of speech |
| Hint returned, and priced to the candidate | "recorded as needed refocusing" |
| Answer ended on its own silence | 3.6 s after speech stopped |
| **Turn latency, answer submitted → next question** | **7.0 s** (was ~24 s) |

The interviewer's follow-up, unprompted, from the candidate's own words: *"That
settlement pipeline sounds really interesting. Reconciling 400,000 transactions daily
across three different processors is no small feat…"*

The composer was also exercised on four sentences against live Gemini, including
Hinglish (*"kal Zoho ka interview hai, DSA round, thoda nervous hoon"* → Zoho, coding,
`hindi_english`) and an employer we do not know (Sagitec Solutions → correctly
`inferred`, with the grounding note saying so).

## Assumptions I made

- **A "loop" is your call, not mine** — see below. Everything I built stays inside the
  existing one-session-one-round model.
- **Hints are text, not speech.** Reusing the async speech machinery would have meant
  another column, another poll and another endpoint, and a hint is something you re-read.
  Worth revisiting.
- **One hint per question**, idempotent — asking twice returns the same hint rather than
  buying a second one. Otherwise a candidate could farm hints.
- **A hint that cannot be produced does not fail the session**, unlike an assessment.
  Nothing is being scored, so the round carries on.
- **Silence ends an answer after 3.5 s, and never in its first 2 s.** Tuned by hand
  against one voice. Real candidates pause longer under pressure than a rendered answer
  does — see below.
- **System serif for display type**, not a licensed face. A `next/font/google` fetch is a
  build-time network dependency and a red-CI risk, and choosing a real face is a design
  decision that belongs to you.
- The composer defaults an unrecognised round type to `project_deep_dive`.

## What I could NOT verify

- **Whether 7 seconds feels right.** It is three times better; it is not real-time.
  Layrs sells continuous voice. Judging the gap is yours.
- **Whether the silence threshold is right for a nervous human.** My test voice pauses
  like a synthesiser. A real candidate mid-thought may well get cut off at 3.5 s, and
  that would be a bad experience in exactly the moment that matters. **Watch this
  first** when you use it.
- **Whether the interviewer sounds like a person.** It said "Hi, good morning. My name is
  Amit, and I'm a Technical Lead here" and the follow-ups were specific and sharp — but
  that is my read, and `CLAUDE.md` says persona realism is yours.
- **Visual design direction.** Screenshots are in the run, but the serif/paper decision
  is a proposal, not a settled choice.
- **Google sign-in through the harness** — it injects a session cookie instead.
- **A whole round and its report.** The harness runs one turn. The report path is
  unchanged from the last run but was not re-exercised end to end tonight.
- **Anything about Layrs behind their login.** I read their public pages and the client
  bundles behind their authenticated routes. I did not create an account or sign in.

## Verification status

| Check | 003 | 004 | 005 | 006 | 008 |
|---|---|---|---|---|---|
| `npm run typecheck / lint / test / build` | pass | pass | pass | pass | pass |
| `./gradlew ktlintCheck test build` | pass | pass | pass | pass | pass |
| CI run, both jobs | 33712963020 | 33715475254 | 33717058869 | 33734883939 | see below |

Web tests 40, API tests 48. Every merge waited on `gh run watch`.

## Merge status

All four merged into `develop`, each after CI was green on both jobs:

- `feat/003-turn-latency` → `1a17495`
- `feat/004-the-room` → `231bf42`
- `feat/005-the-composer` → `c600916`
- `feat/006-shell-and-catalogue` → `dc6ff32`
- `feat/008-no-payment-gate` — every round free (added after the run; see above)

`chore/007-browser-harness` (this file plus `scripts/e2e/`) is pushed and merged on the
same gate. Two migrations were applied to the hosted database with `npm run db:push`:
`20260902100000_async_question_speech` and `20260903020000_asked_for_hint`. Both are
additive.

Nothing was pushed to `main`.

## Added after the run: no free-versus-paid gate

You asked for every round to be free until there is a real paid system to gate behind.
Done, and verified: a candidate with **two completed rounds started a third** — 201, not
402.

It is a config property rather than deleted code. `interviewos.entitlement.free-rounds`
is absent, which means unlimited; `EntitlementProperties` defaults it to null and
`application.yml` carries the commented line that brings it back. `Entitlement.kt` still
does the arithmetic and its tests still cover both sides, so restoring the gate is one
line of YAML, not a rewrite.

Two things worth knowing:

- **The one-at-a-time rule stays.** It is not commercial — two live sessions would race
  each other's turns — so `session_in_progress` still blocks.
- **`EntitlementView.remainingFree` is now `number | null`,** where null means there is
  no limit. Reading null as "none left" would have put a paywall notice on a product
  with no paywall, so the dashboard branches on it explicitly.

Copy that promised a gate is gone: the landing page now says *"Every round is free right
now… When there is something worth charging for, we will say so before we charge for
it."* And **`CLAUDE.md` is updated** — its settled-decisions list said "one complete mock
interview, then paid", which the next autonomous run would have read as a bug to fix.

## The two things I did not build, because they are yours to decide

**1. Loops — their best idea, and our biggest gap.**

A loop is a whole onsite: several rounds against one company at one level, with a real
onsite date, a days-left countdown, readiness tracked against it, and a **committee
debrief that reads every round together**. It is how interviews actually happen, and a
per-round product will always feel like a fragment beside it.

It collides head-on with a settled rule. `CLAUDE.md`: *"Interview context is chosen per
session, not stored as a persistent target list… no setup step that asks them to declare
targets in advance. Do not build a 'my targets' entity."* A loop is a persistent entity
with a company and a date on it.

There is a reading that fits — a loop is a *plan over sessions*, created ad hoc, each
round still scoped to one company and one role, progress still derived — but that is a
reinterpretation of an explicit rule, it is easily 800+ lines, and it changes the
information architecture. **I stopped rather than decide it in an unattended run.** If
you want it, the committee debrief is the part worth building first: it is the only
thing here that no competitor's per-round feedback can match.

**2. Showing what we checked.**

Layrs runs about a minute of live research on a company's real loop and **shows the
source URLs**. When it fails: *"We only draft loops we can verify, so we won't hand you a
made-up one"*, with an opt-in to a generic FAANG-style loop.

We already refuse to fabricate — `ArchetypeResolver` reports `recognised` or `inferred`
and the note says which. What we do not do is *show our working*. Their version is more
convincing than ours despite ours being no less honest. Closing that means retrieval with
provenance, which is PRD §03/§04 territory and a real piece of work.

## Suggested next task

**Resume upload and parsing.** It is still the largest hole. The project deep-dive round
is our strongest differentiator and it currently runs on company, role and round type
alone — the interviewer asks about "your recent work" instead of about the settlement
pipeline on page one of the CV. The Gemini seam and the prompt already exist; there is no
endpoint and no UI.

Ahead of that, one thing from the last handoff is **still not fixed**: deleting a user
removes their rows but leaves their audio and video in storage.
`ObjectStorage.deleteByPrefix` exists and nothing calls it. `CLAUDE.md` requires deletion
to actually delete. It is small, and it has now survived two runs.

## Open questions for you

1. **Loops: yes, no, or a narrower version?** This is the one that changes the roadmap.
2. **Is 3.5 s of silence too short to end an answer?** My only test voice was synthetic.
3. **Nothing limits model spend now that rounds are unlimited.** A round is roughly two
   Gemini calls per turn plus one for the report, and anyone signed in can run as many as
   they like. That is the right trade while you are gathering feedback, but it is worth a
   ceiling — per day, or per account — before the link goes anywhere public.
4. **When pricing does arrive, their "Interview Sprint" is the shape to beat** — ₹3,999
   for 3 months, prepaid, no auto-renew, built around a 6–10 week job hunt. That matches
   how candidates actually buy far better than a subscription does.
