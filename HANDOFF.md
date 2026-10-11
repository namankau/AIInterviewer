# Handoff — 2026-10-11

## Task
Add production-grade interview observability so a stopped or stalled mock interview can be reconstructed by user, elapsed time, turn, system phase, provider attempt, and interviewer decision. User request; no task file.

## What I built
- Added ADR 001 defining a privacy-safe, append-only interview event ledger, its event vocabulary, access boundary, retention, and failure semantics (`docs/adr/001-interview-event-ledger.md`).
- Added the RLS-protected `interview_events` table with ownership, session/request correlation, bounded diagnostic fields, cascade deletion, indexes, and 28-day retention support (`supabase/migrations/20261010000000_interview_event_ledger.sql`). The migration was applied to the linked Supabase project and local/remote migration state was verified in sync.
- Added a best-effort, independent server-side recorder plus scheduled retention purge and an admin-only session timeline endpoint (`apps/api/src/main/kotlin/com/interviewos/api/interview/InterviewEventLedger.kt`).
- Instrumented answer ingress, assessment, persistence, provider attempts/fallbacks, speech generation, interviewer action/intervention, and terminal session outcomes without storing transcripts, audio, prompts, model output, names, emails, URLs, stack traces, or exception text.
- Instrumented the interview room with phase transitions, a 30-second heartbeat, page-hidden markers, answer submission start/failure/slow events, browser speech failures, question-audio polling failures, and playback failures/timeouts.
- Added backend access/ledger/telemetry/speech tests and frontend behaviour tests. The change is larger than 800 lines because the schema, server and browser instrumentation, privacy contract, endpoint, and tests must ship as one coherent observability boundary.

## Assumptions I made
- “Which user” means the immutable owner UUID returned only through the existing admin authorization boundary, not duplicating email or profile data into the ledger.
- Diagnostic events are retained for 28 days, long enough for incident investigation while limiting personal-data exposure.
- Interviewer behaviour is represented by bounded action and intervention enums (for example `probe`, `move_on`, `redirected`, `hinted`) rather than storing generated question text or candidate content.
- A 30-second browser heartbeat is sufficient to distinguish an active but slow round from a closed, hidden, disconnected, or frozen client without producing excessive write volume.
- The browser's 190-second marker is named `answer_submission_slow`, not timeout, because it does not abort the request and a late response may still succeed.

## What I could NOT verify
- The original six-minute incident cannot be reconstructed retroactively because these events did not exist when it happened.
- No live interview or Gemini call was run, in accordance with the repository's no-live-AI-spend rule. Provider behaviour and voice quality therefore remain unverified in a real session.
- Application deployment is outside this branch; the database is ready, but new event recording begins only after the API and web changes are deployed.

## Verification status
- Frontend: typecheck, lint, 2,985 tests, and production build pass locally.
- Backend: `ktlintCheck`, 709 tests, and production build pass locally.
- Database: migration `20261010000000` applied to the linked Supabase project; local and remote migration histories match.

## Merge status
- Branch `feat/interview-observability-ledger` pushed unmerged for a human-review PR because this change defines personal-data observability and an admin permission boundary. `develop` and `main` were not modified.

## Suggested next task
- Add an operator-facing timeline view or runbook over the admin endpoint, and connect the existing structured application logs/Sentry configuration to the production collector for infrastructure-level incidents outside an interview session.

## Open questions for you
- None.
