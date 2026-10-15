# Handoff — 15 October 2026

## Task
Make the post-interview report handoff and signed-in navigation fast, and explain the intermittent "Account unavailable" / "daily progress unavailable" errors (direct request; no task file; PRD §09).

## What I built
- `apps/web/src/components/interview-complete-panel.tsx` (moved out of `interview-room.tsx`): the closing screen now requests the report as soon as the round ends — which is what starts generation, since `ReportService.report` writes the report on its first GET — and shows a live activity panel (rotating status line, elapsed time, four analysis steps). "Read the report" appears only once the report exists, as a client-side `Link`. A non-transient failure offers "Open the report page"; after ten minutes it does the same with "taking longer than usual".
- `apps/web/src/lib/report-cache.ts`: in-memory, per-tab cache of loaded reports. `report-view.tsx` renders from it, so the report opens instantly from the closing screen. Cleared on sign-out.
- `apps/web/src/components/route-loading.tsx` + `loading.tsx` in dashboard, courses, interview/new, arena, questions, report/[id], history, profile, rounds, upgrade: Next only prefetches a dynamic route when it has a `loading.tsx`, so top-nav clicks previously did nothing visible until the server finished the page.
- `apps/web/src/components/account-summary.tsx`: remembers the last loaded profile in memory, so the header no longer shows a loading placeholder and refetches `/me` on every navigation; a failed background refresh no longer replaces a known profile with "Account unavailable". `forgetAccount()` clears it (and the report cache) on sign-out.
- `apps/web/src/lib/api.ts`: GET requests retry twice (400 ms, 1.2 s) on a network error or 502/503/504. Writes are never retried.
- Tests: `lib/api-retry.test.ts` (new), plus updates in `interview-room.test.tsx`, `report-view-polling.test.tsx`, `account-summary.test.tsx`.

## Assumptions I made
- The analysis steps advance on a clock because the API only reports "generating" or "done". The final step never shows as finished before the report is saved.
- Leaving the closing screen aborts only the browser request; the server keeps writing the report and stores it.

## What I could NOT verify
- Real timing in a browser against the live API (no live rounds or AI spend, per rule 7). In `next dev`, Next never prefetches and compiles each route on first visit, so navigation there will still be slower than a production build.
- The root cause of the intermittent "unavailable" errors. Both messages mean the browser could not get an answer from the API. Likely causes: the API still booting (`bootRun` takes far longer than `next dev`), the API down after a startup failure such as today's `interviewBackgroundExecutor` crash, or the database pooler refusing connections. Hovering "Account unavailable" shows the actual error message, and the API terminal shows the server side.

## Verification status
- Frontend typecheck, lint, tests (80 files, 3,064 tests) and production build: pass locally. No backend changes.

## Merge status
- Branch `fix/report-handoff-and-nav`.

## Suggested next task
- Start report generation server-side when a round finishes (background job), so the report is written even if the closing screen is never shown.

## Open questions for you
- None blocking.
