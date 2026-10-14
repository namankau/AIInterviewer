# Performance fixes — 14 October 2026

This follows the read-only findings in `PERFORMANCE_AUDIT.md`. Changes are one logical fix per commit. No dependency, schema, AI prompt, cache policy, or live model call was added.

## Verified before and after

These are controlled code-path observations, **not** real-device latency measurements. The original audit's LCP, INP, TBT, endpoint p50/p95, and click-to-paint baselines remain unmeasured.

| Finding | Change | Before | After | Evidence |
| --- | --- | --- | --- | --- |
| F01 | Keep the interview workspace node stable across microphone-level updates | Mock workspace rendered twice across one meter update | Rendered once | Regression test failed before, passed after; `58d9dd7` |
| F03 | Let the dashboard primary action appear while readiness loads | With readiness unresolved, Start action absent for the test's 1-second window | Start action visible during that window | Regression test failed before, passed after; `0b70d05` |
| F06 (loading gate) | Expose the existing self-setup option while loop brief loads | Skip unavailable while brief was unresolved | Skip available and clickable | Regression test failed before, passed after; `0d64aa5` |
| F08 | Set answer-processing state before recorder finalization | Processing status absent while `capture.stop()` was unresolved | Status present while unresolved | Regression test failed before, passed after; `43981f5` |
| F09 | Allow only one question-audio poll in flight | Four concurrent GETs accumulated over 1.6 seconds with the first held | One GET in flight; next poll still occurs after resolution | Fake-timer test failed before, passed after; `cf045c0` |
| F07 | Stream optional usage counter behind the landing hero | Page component awaited usage before returning its hero | Page returns hero immediately; counter resolves inside Suspense | Code-path inspection, typecheck, production build; `c12bbe6` |
| F14 | Load profile, history, and Arena independently; show returned resume before reconciliation GET | Main profile stayed skeleton while secondary requests hung; returned resume was hidden until another GET | Main details and returned resume visible while those requests are pending | Two regression tests failed before their fixes, passed after; `3977b68` |
| F04 (parsing only) | Parse each readiness report JSON once per row | A two-row spy test observed more than two parser calls | Exactly two parser calls | Focused backend test failed before, passed after; `218bba1` |

The F07 and F14 changes alter when existing content appears. F14 keeps the profile GET after upload because server-side detected skills must be reconciled. F03 leaves readiness independent of the primary dashboard. None of these changes trades data freshness or correctness for speed.

## Full local verification

- Web: typecheck, lint, 74 Vitest files / 3,024 tests, and Next production build passed.
- Backend: `ktlintCheck test build` passed.
- Root script tests: 77/77 passed when localhost fixture access was allowed. The first sandboxed run failed two tests with `connect EACCES 127.0.0.1`, then passed unchanged outside that restriction.
- `git diff --check` passed.

## Remaining work that needs measurements or a larger design change

- **F02 and F05:** session opening and first-report generation include model work on synchronous request paths. Moving either to an asynchronous job requires state, retries, and failure handling. No live model or candidate latency trace was authorized, so these were left intact.
- **F04:** the repository still reads unbounded full report payloads. Measure real account history sizes and a sanitized `EXPLAIN (ANALYZE, BUFFERS)` before changing the query or adding an index.
- **F06:** brief and plan still repeat loop resolution. Confirm actual model-backed call frequency and provenance behavior before sharing results.
- **F10–F13:** unbounded session history, Arena corpus timing, duplicate token work, and question index scaling remain as recorded in the audit. Profile their real impact before changing API contracts or loading policy.

The local sandbox did not provide a reachable authenticated application/API or browser trace for Web Vitals and endpoint timings. The fixes above therefore establish behavioral and work-count improvements, while real user-perceived milliseconds remain unknown.
