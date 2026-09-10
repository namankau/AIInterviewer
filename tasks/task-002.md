# Task 002 — Onboarding, and the first complete voice interview

**Run type:** unattended overnight
**Target branch:** `feat/002-interview-loop` → merge into `develop` when green
**PRD reference:** §05 (profile), §06 (engine), §09 (feedback and scoring), §13 (mobile-readiness)
**Depends on:** task 001, merged

Read `CLAUDE.md` first — all of it, including the quality bar under "Design direction"
and the settled product decisions. `develop` is the only branch you push to.

---

## Goal

A stranger lands on the site, understands what it is, signs in, uploads a resume,
confirms what was parsed, and takes a real spoken mock interview with their camera on.
Afterwards they get a report that quotes what they actually said, and they can see their
readiness move across attempts.

Success means the owner can hand the URL to a candidate with no explanation, and the
candidate gets through it and finds the report worth paying for.

---

## Decisions already made — do not relitigate

1. **Google Gemini is the AI provider.** `GEMINI_API_KEY` is in `.env` and works.
   - `gemini-3.5-flash` — reasoning, audio understanding, scoring
   - `gemini-2.5-flash-preview-tts` — interviewer voice, returns 24 kHz PCM
   - `gemini-2.5-pro` 404s for new keys. Do not use it. Do not use Anthropic or OpenAI.
2. **Voice is turn-based and needs no voice vendor.** Verified: Gemini both speaks the
   question and understands a spoken answer. Browser `MediaRecorder` captures the
   answer, uploads it, the backend sends it to Gemini. **Do not add LiveKit or Pipecat**
   — realtime barge-in is a later, separate decision.
3. **Camera on, consent first.** Request mic and camera at session start. Record both.
   Consent is explicit, separately covers audio and video, and is stored with a
   timestamp. No consent, no session. Body-language *analysis* is not in this task —
   capture the video, analyse later.
4. **All interview logic server-side.** The browser captures media and renders. It never
   selects a question or computes a score.
5. **Degrade honestly, never fake.** If Gemini is unavailable, say so and let the
   candidate retry — do not silently fall back to canned questions and present the
   result as a real assessment. A failed session is `failed`, not a fake pass.
6. **Question grounding is archetype-level.** Resolve the named company to an archetype.
   If nothing is known about that specific employer, use archetype and function patterns
   and *say so in the UI*. Never invent a specific claim about a real company's process.

---

## Scope

### 1. The public site

This is the brand surface and the SEO surface. It must not look generated — re-read the
quality bar in `CLAUDE.md` before writing any markup.

- A landing page that explains the product in specific language: which employer
  archetypes, which round types, what the report actually contains.
- Honest pricing: one free interview including the full report, then paid.
- Server-rendered, fast, real metadata.

### 2. Onboarding — resume, then profile

- Upload PDF and DOCX. Reject anything else with a clear message. Size limit enforced on
  both client and server. Store in Supabase Storage, private, owner-only via RLS.
- Record in `resumes` with `parse_status = pending`. Re-upload creates a new version;
  keep prior versions rather than hard-deleting.
- **Parse asynchronously** — upload returns immediately, the UI reflects real status.
  Transitions `pending → processing → parsed | failed`, with a readable reason on
  failure. Extract with Gemini: employers with dates, titles and level progression,
  projects with technologies, domains, education, certifications, detected skills, and
  gaps and short tenures computed from the dates.
- **Mark uncertain fields low-confidence rather than guessing.** A wrong employer
  silently degrades every future interview.
- Confirmation screen: everything pre-filled and editable, low-confidence fields
  visually flagged, user can add what the parser missed. This *is* the profile step —
  do not build a separate multi-step wizard.
- Then: function, current level, target level, total experience. Skills reconciled
  between parser-detected and self-rated, with explicit "weak areas I want pushed on".
  Context fields (location, relocation, work authorisation, notice, compensation band)
  are optional and must never block reaching a first interview.

Parse quality matters more than parse speed. Report honestly on what it handled badly.

### 3. The interview

- Candidate names company and role, picks a round type, grants consent, and begins.
- Interviewer speaks each question (TTS). Candidate answers by voice with camera on.
- Persist every turn as it happens — a refresh or a dropped connection must not lose the
  session. Store audio and video objects owner-only.
- The engine assesses each answer in flight and chooses the next turn: follow up, probe,
  challenge a weak claim, move on, or raise difficulty (PRD §06).
- The session screen stays near-empty: speaking indicator, timer, round label, exit.
  No score ticker, no live hints. Show the live camera preview small and unobtrusive.
- Exiting mid-session leaves it `abandoned`, not deleted.

### 4. The report (PRD §09)

This is where perceived value concentrates and where payment is justified. Required:

- Competency scores against the function and level rubric, **each justified by a quoted
  moment from the candidate's own transcript**.
- Answer-level annotations: what worked, what was vague, what a real interviewer would
  have probed, and a stronger framing for the weakest answers.
- Communication analysis: structure, filler density, pace, rambling, handling not
  knowing an answer.
- A targeted practice plan and the next recommended session type.
- An outcome simulation, clearly labelled as a simulation.

### 5. Readiness

Group completed sessions by (company, role), derived — **there is no targets table**.
Show competency movement across attempts and recurring weaknesses. Evidence, not a badge.

### 6. Free tier and payment

- One complete interview free, report included. After that, gate starting a new session.
- Razorpay integration behind an interface, in test mode only. **Do not wire live keys
  or set real prices** — that is the owner's decision. Build the seam; leave it unarmed.

### 7. API

Extend the versioned public API — mobile will consume the same routes.

- `POST /api/v1/resumes`, `GET /api/v1/resumes/{id}`
- `GET /api/v1/profile`, `PATCH /api/v1/profile`
- `POST /api/v1/sessions`, `GET /api/v1/sessions/{id}`, `POST /api/v1/sessions/{id}/turns`
- `GET /api/v1/sessions/{id}/report`, `GET /api/v1/readiness`

Every route enforces ownership. A user must never read another user's resume, session,
media or report.

### 8. Tests

- Unit: date maths (tenure, gaps) — silent bugs live here. Session composition. Scoring.
  Readiness aggregation. Free-tier gating.
- API integration: happy path, unauthenticated, **and a cross-user access attempt that
  must fail**, per route.
- UI: behaviour and accessibility, not snapshots.
- **Mock Gemini at the boundary.** No test may call a live third-party API.

---

## Blocked — build the seam, note it in `HANDOFF.md`

- **WhatsApp reminders.** Needs a WhatsApp Business account, business verification and
  per-template approval from Meta; approval takes days. Adapter interface only.
- **Email delivery.** Needs a provider account and a verified sending domain. One
  adapter behind the interface, left unconfigured.
- **Live payments.** Test mode only. Real keys and pricing are the owner's.

---

## Out of scope

Realtime voice transport and barge-in. Body-language analysis. Community-contributed
reports, rewards, and salary data — later phases, do not scaffold. Scrapers, always.
Function verticals beyond Wave 1 (backend/full-stack, QA and automation, data and AI
engineering).

---

## Definition of done

- [ ] A stranger completes landing → sign-in → resume → profile → interview → report
      with no instruction
- [ ] The interview is spoken, camera on, consent captured before any capture starts
- [ ] Every competency score cites a quote from that transcript
- [ ] Cross-user access is proven impossible by a test, on every route
- [ ] Media objects are owner-only and account deletion removes them
- [ ] Free-tier gating works and the free interview includes the full report
- [ ] No employer-specific claim renders without a provenance label
- [ ] Typecheck, lint, tests, build green for both apps
- [ ] **CI green and you have seen it** — `gh run watch`. Cannot see it, gate not passed
- [ ] `HANDOFF.md` per template, including honest parse-quality and cost observations
- [ ] Merged into `develop`, or branch pushed unmerged with the reason stated

---

## Notes for the run

- **If you are going to overrun, ship the loop end to end and drop scheduling,
  reminders and payment.** A complete interview that works beats six half-features.
  Say what you dropped.
- Split the work: public site, onboarding, interview, report, readiness. Task 001 ran to
  ~3,000 lines in one commit and that was too large to review.
- Use fixture resumes you generate yourself. Never commit a real person's resume.
- Keep Gemini prompts and response schemas in version control, and note observed
  per-session token cost in `HANDOFF.md` — it is a per-user cost that decides pricing.
- `gh` is installed and authenticated. Verify CI rather than assuming.
- Migrations are owned by the Supabase CLI. Never edit an applied one; add a new one.

---

## After this task

Write `tasks/task-003.md` yourself, choosing what most advances a paid, trustworthy
product from wherever task 002 actually ends — not from where it hoped to end. State
the reasoning in one paragraph at the top.
