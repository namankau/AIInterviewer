# Functional end-to-end check — 14 October 2026

## Result

No application defect was reproduced in the paths that could be tested without live AI calls or a backend connected to the configured database. This is **not** a pass for the complete interview journey: authenticated API behavior, recording, speech, and reports remain unverified end to end.

Tests used the local `feat/performance-audit` checkout, not the deployed `develop` branch. No repository code or external data was changed during this check.

## Observed behavior

| Flow | Observation | Status |
| --- | --- | --- |
| Public routes | `/`, `/login`, `/terms`, `/privacy`, `/contact` returned HTTP 200. Landing content rendered in the browser. | Pass |
| Anonymous route guard | `/dashboard`, `/profile`, `/courses`, `/arena`, `/questions`, `/rounds`, `/history`, `/interview/new`, and `/report/test-id` returned HTTP 307 to `/login?next=<original path>` without an auth cookie. | Pass |
| Existing browser session | Browser navigation reached dashboard, interview setup, courses, a Java course and chapter, Arena, and a Java Arena course. | Navigation pass; data unverified |
| Course catalogue | Typing `java` in search reduced the four listed courses to Java Programming; its course and first chapter links opened. | Pass |
| Arena course | The Java Arena course and chapter links rendered. Progress-based play stayed in its error/loading state because the API was stopped. | Navigation pass; play unverified |
| Local landing HTTP response | The production server returned HTTP 200 with 114 ms local TTFB in one request. | Single local observation, not a user-latency baseline |

The browser displayed `Failed to fetch` on API-backed panels while the backend was stopped. This is an expected consequence of the test setup, not a confirmed application defect.

## Safe automated checks

- Agent-run auth route guard tests: 28/28 passed.
- Agent-run Google sign-in, course catalogue, and Arena session tests: 19/19 passed.
- A larger test batch had sandbox temporary-file `ENOENT` failures during imports. The focused reruns above passed; the import errors did not establish a product defect.
- The preceding performance-fix run on this same branch passed the full web suite (74 files, 3,024 tests), backend `ktlintCheck test build`, and 77 root script tests. Those are automated checks, not browser end-to-end coverage.

## Why the complete journey was not run

- The repository's `scripts/e2e/interview.mjs` harness uses real credentials and live Gemini. `AGENTS.md` prohibits live interviews and AI spend without owner approval. The harness covers one interview turn, not the final report.
- Starting the backend with the root `.env` would connect to its configured database. `StorageDeletionRetryJob` begins after 10 seconds and report retention after 5 minutes, so the backend was left stopped rather than risk modifying external data during a read-only audit.
- `next dev -p 3100` reached Ready in the agent's Windows sandbox but Turbopack could not create a Sentry junction (`Access denied`). The production server started and served pages when both server and browser/request used matching network permissions. This is a local environment limitation, not a confirmed product failure.

## Coverage still needed

Use an isolated staging database/storage project and a disposable test account, with scheduled deletion jobs disabled or directed only at staging. Then verify Google OAuth, dashboard/profile API data, course progress, Arena answers and progress, interview setup, device consent, microphone capture, speech playback, a full round, and report generation. A live Gemini run requires the owner's explicit spending approval.
