# Handoff — 14 October 2026

## Task
Phase 2 performance fixes after the user approved work on `PERFORMANCE_AUDIT.md` (direct user request; no task file).

## What I built
- `PERFORMANCE_FIXES.md` records the controlled before/after results and remaining unmeasured work.
- F01: stabilized the interview workspace across microphone-level renders (`apps/web/src/components/interview-room.tsx`).
- F03: made the dashboard primary action independent of readiness (`apps/web/src/components/dashboard-panel.tsx`).
- F06: made self-setup available while a loop brief loads (`apps/web/src/components/loop-brief-step.tsx`).
- F08 and F09: showed answer processing before recorder finalization and prevented overlapping question-audio polls (`apps/web/src/components/interview-room.tsx`, `apps/web/src/lib/use-question-audio.ts`).
- F07 and F14: streamed optional landing usage after the hero and revealed profile/resume content before secondary data finishes (`apps/web/src/app/page.tsx`, `apps/web/src/components/profile-panel.tsx`).
- F04: reduced readiness JSON parsing to once per report row (`apps/api/src/main/kotlin/com/interviewos/api/interview/ReadinessService.kt`).
- Added focused regression tests for the behavioral and work-count changes. Each fix is in its own commit.

## Assumptions I made
- Prioritized changes that remove a proved wait or redundant work while preserving the API and model behavior. I left the larger asynchronous session/report designs for measurement and design review.
- Kept the profile GET after resume upload because detected skills are assembled server-side; the returned resume appears immediately, then reconciles with that GET.
- Treated the audit's time estimates as inferred from code. Controlled tests establish response order and work count, not real user-perceived milliseconds.

## What I could NOT verify
- Real-device LCP, INP, TBT, click-to-paint, endpoint p50/p95, authenticated flow timings, or database query plans. The original sandbox denied loopback access to the app, and no authenticated browser/API environment or representative data set was available.
- F02/F05 model-backed critical paths, the remaining F04 full-payload query, F06 duplicate loop resolution, and F10–F13 need profiling or larger design work. No live AI call or model spend was run.
- GitHub CI for this local branch has not run or been observed. The repository both limits pushes to `develop` and forbids merging into `develop` without observed green CI, so this branch was not pushed or merged.

## Verification status
- Web: typecheck, lint, tests (74 files, 3,024 tests), and production build passed.
- API: `ktlintCheck test build` passed.
- Root scripts: 77/77 tests passed when local fixture networking was allowed. The initial sandboxed run failed two localhost fixture requests with `EACCES`, without a code change.
- `git diff --check` passed. CI status is unknown.

## Merge status
- Local branch `feat/performance-audit` is unpushed and unmerged. `develop` and `main` were not changed. CI cannot run for these commits under the current push restriction; no merge gate has been met.

## Suggested next task
- Choose a permitted way to trigger CI for this branch, then merge into `develop` only after all CI jobs are green. Collect browser/API traces for F02, F05, and the remaining F04 query work.

## Open questions for you
- May this feature branch be pushed solely to run CI, or should a different CI path be used while keeping the `develop`-only push rule?
