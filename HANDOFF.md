# Correction — 29 August 2026

The verification described below was real, but narrower than it reads. I drove the loop
with **WAV** audio posted by a script. A browser was never run through it, and three
things that only a browser exercises were broken:

- **Answer submission returned 500 whenever the camera was on.** Chrome labels a
  recording `video/webm;codecs=vp9,opus`; the comma is illegal in an unquoted HTTP
  parameter, so parsing the part's content type threw before the upload was attempted.
- **The interviewer's voice never played.** Gemini's TTS returns headerless PCM, which
  no `<audio>` element can decode. Every question was silent text on screen.
- **The camera opened without video consent**, because the client keyed off session
  status rather than the consent flag — which the API did not expose at all.

All three are fixed and re-verified by posting Chrome's exact content types at a running
API against live Gemini: 200, both media objects stored, the answer transcribed from
webm/opus, and the question audio serving as `audio/wav` with a RIFF header.

**The lesson worth keeping:** "verified end to end" meant end to end *of the server*. The
client's real output was never in the loop. Anything that only a browser produces —
container formats, consent, device permissions — needs a browser to verify.

---

# Handoff — 26 August 2026

## Task

Task 002 — onboarding and the first complete voice interview (`tasks/task-002.md`).
Partially delivered. The interview loop works end to end and is verified against the
live project; resume upload and onboarding are **not** built.

## What works, verified against the real project

I ran a full interview through the running API against live Gemini and the hosted
database. Not a mock — a real session, with the transcript and report to show for it.

**The interviewer probes and pushes back.** Given a strong answer about moving to an
append-only ledger, it followed up on the specific claim:

> "You mentioned moving to an append-only ledger with an async projection into the read
> model. How did you reliably propagate those writes, and how did you handle failures or
> lag in that pipeline?"

Given a deliberately weak follow-up answer ("we just retried it… it was mostly fine"),
it challenged rather than moved on:

> "Polling a ledger table that's receiving hundreds of writes per second can degrade
> database performance and introduce significant lag. How did you track which records…"

The engine recorded `probe` for the first and `challenge` for the second, which is the
adversarial realism the product is supposed to sell.

**The report is specific and unflattering.** Three competencies, each carrying a real
quote from the candidate's own transcript, scored apart rather than averaged into
mush — Ownership and trade-off analysis 4/5, Technical depth and operational excellence
2/5 — and an outcome of "Borderline / No Hire". Headline: *"Strong initial architectural
framing but struggles to defend operational details under deep-dive scrutiny."*

**Google sign-in works.** Your account is in `auth.users` via the `google` provider —
that is the one thing I could not test myself, and it is now confirmed by your own
sign-in.

## What I built

- `InterviewService` — starts sessions, conducts turns, decides when a round ends. All
  server-side; the client never selects a question or computes a score.
- `ArchetypeResolver` — maps a typed company name to an employer archetype and reports
  whether that was **recognised** or **inferred**. Both the model prompt and the
  candidate-facing note say so. Even the recognised path forbids stating specific facts
  about that employer's process.
- `ReportService` — composes the report and **drops any competency score whose evidence
  quote cannot be found in the transcript**. An invented quote is worse than a missing
  score.
- `Entitlement` — one free interview, derived from completed sessions and captured
  payments rather than stored as a flag. An abandoned session does not consume it.
- `ReadinessService` — groups completed sessions by (company, role). A weakness counts as
  recurring only if it appears in more than one session.
- Frontend: session setup with per-stream consent, the live interview room (voice +
  camera, near-empty by design), the report, and a dashboard wired to real data.
- `useInterviewCapture` — records audio and video separately from one device stream.

## Numbers you need for pricing

Measured on a real 2-turn session with `gemini-3.5-flash`:

| | |
|---|---|
| Per answer turn (transcribe + assess + next question + TTS) | **~24 s** |
| Report generation | **~16 s** |
| Report tokens | 765 in / 1,630 out |

**24 seconds between answering and hearing the next question is too slow** for something
sold as realistic. It is the single biggest quality problem in what exists now. Most of
it is audio upload plus TTS; streaming the question text while speech renders, and
sending audio while the candidate is still finishing, would both help.

## A data-protection gap I found and did not fix

**Deleting a user removes their database rows but leaves their audio and video in
storage.** The `users` foreign keys cascade; storage objects have no such relationship. I
confirmed this by deleting the test user and finding five media files still present, then
removed them by hand.

`CLAUDE.md` requires that account deletion actually delete, including storage objects.
`ObjectStorage.deleteByPrefix` exists for exactly this — nothing calls it. **This is the
first item in task 003.**

## What is NOT built

- **Resume upload, parsing and profile completion.** The Gemini parsing seam and prompts
  exist; no endpoint, no UI. This means interviews currently run on company, role and
  round type alone — the resume-grounded project deep-dive, which is the strongest
  differentiator, is not yet personalised to the candidate's real work.
- Landing page still says what task 001 left.
- Scheduling, reminders, and any payment flow. Razorpay is a table and nothing more.
- Integration tests for the new controllers, including the cross-user access test the
  brief demands. Unit tests cover the pure logic; the HTTP layer is unverified by tests
  even though I exercised it by hand.

## Assumptions I made

- **`gemini-3.5-flash` for everything except speech**, `gemini-2.5-flash-preview-tts` for
  the interviewer's voice. `gemini-2.5-pro` returns 404 for new keys.
- **A session is capped at 8 turns**, to bound both length and cost.
- **The model's suggested next action is advisory.** The engine normalises it and owns
  the decision, so a malformed suggestion cannot derail a session.
- **Speech failure degrades to a written question** rather than failing the session.
  Assessment failure does not degrade — the session is marked `failed`, because scoring
  someone unfairly is worse than stopping.
- `RestClient.Builder` is defined explicitly; Spring Boot 4 does not contribute one, and
  adding a starter for a single bean was not worth it.

## Verification status

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | pass — 18 |
| `npm run build` | pass |
| `./gradlew ktlintCheck` | pass |
| `./gradlew test` | pass — 38 |
| Live interview against Gemini + hosted DB | pass, by hand |

## Merge status

Merged into `develop`. CI verified green with `gh run watch` before merging — the gate
that task 001 failed six times without noticing.

## Suggested next task — `tasks/task-003.md`

I have not written it yet. It should lead with **account deletion that actually deletes
storage**, then **resume upload and parsing** (without it, the deep-dive round is generic
and the main differentiator is unrealised), then **turn latency**, then the integration
tests this run skipped.

## Open questions for you

1. **24 s per turn — acceptable for now, or the next thing I fix?** It is the difference
   between "realistic" and "a form that talks".
2. The free interview currently costs us two Gemini calls per turn plus one for the
   report. At 8 turns that is real money per free user. Worth deciding a cap before
   anyone but you uses it.
