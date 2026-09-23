# Handoff — 2026-09-23

## Task
Harden interview privacy, retries, state transitions, deletion, report generation, and
public contracts. `tasks/task-058-interview-integrity.md`.

## What I built
- Camera remains a browser-only preview. The web/API/AI contracts no longer carry video,
  and the API rejects a legacy video part before storage or model invocation.
- Answer, hint, workspace, and session transitions are conditional. Stable request IDs
  replay accepted answer/hint results instead of spending twice.
- Candidate deletion and retention enqueue durable storage-deletion jobs before rows are
  removed. A leased retry worker uses backoff and a settling pass for in-flight uploads.
- Retention clears candidate-authored board data while preserving generated workspace data.
- Report generation uses a database lease, calls the model outside transactions, and lets
  only the lease owner persist a report.
- The web room admits only active sessions, renders every terminal status, and surfaces
  begin failures on the device-check screen.
- Session language uses the shared `InterviewLanguage` contract and is validated by the
  API. Kotlin report responses are typed and covered by a JSON contract test.

## Assumptions I made
- Duplicate requests return the original accepted result.
- Deletion may return after a durable job exists; object deletion may complete asynchronously.
- Candidate-authored board content is interview evidence and expires with the transcript.
- Generated problem/case workspace may remain on the historical session row.
- A 10-minute report lease and 15-minute storage settling window are conservative recovery
  bounds; both are implementation constants rather than product promises.

## What I could NOT verify
- No live AI calls, interviews, storage deletes, or production deletion flows were run.
- Real PostgreSQL race behavior is not covered because CI has no PostgreSQL/Testcontainers
  service. Service-level concurrent calls verify one model invocation and replay behavior.
- The four new migrations were not applied. The linked database is current only through
  `20260921140000`; branch migrations `20260923090000` through `20260923120000` are local.
- Default Turbopack build cannot run in this worktree because `node_modules` is a junction
  outside Turbopack's filesystem root. The production Webpack build passed.

## Verification status
- Web typecheck: pass.
- Web lint: pass, no warnings.
- Web tests: pass, 48 files / 1,982 tests.
- Web production build: pass with `next build --webpack` and synthetic public env values.
- API `ktlintCheck test build`: pass.
- Linked migration list: pass, read-only; no branch migrations applied.
- PR #16 CI passed on code tip `6caf106`: both the web and API jobs are green.

## Merge status
- Branch `fix/interview-integrity` is pushed. PR #16 targets `develop`:
  https://github.com/namankau/AIInterviewer/pull/16
- The PR remains unmerged because this touches privacy and data deletion and its four
  migrations have not been applied.
- Do not merge until all four migrations have been reviewed and applied and the final
  handoff-only tip remains green.

## Suggested next task
- Review and apply the four migrations, confirm PR #16 CI is green, then approve and merge
  it into `develop`.

## Open questions for you
- Decide whether to add PostgreSQL/Testcontainers coverage to CI before merging, or accept
  the current service-level concurrency coverage for this change.
