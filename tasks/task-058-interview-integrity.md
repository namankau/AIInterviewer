# Task 058 - Interview integrity and privacy hardening

## Goal
Make the interview loop trustworthy under retries, concurrent requests, provider latency,
and storage failures while keeping the public API suitable for future mobile clients.

## Status
Implementation and local verification complete on `fix/interview-integrity`. Awaiting
migration review/application, PR #16 CI, and human review before merge.

## Settled product behavior
- Candidate camera is a local preview only. Camera frames are never uploaded, retained,
  or sent to an AI model.
- Answer and hint retries are idempotent and return the already accepted result.
- Data deletion must have a durable retry record before the API reports success.
- Retention clears transcripts, recordings, reports, and candidate-authored board data.
  Generated workspace material may remain on the historical session row.

## Scope
1. Remove or reject video at the server boundary and prove storage/AI never receives it.
2. Guard answer writes and session transitions atomically.
3. Add stable idempotency keys for answer and hint requests.
4. Add a durable storage-deletion outbox with retry processing.
5. Move report composition outside database transactions and lease generation.
6. Render all session statuses correctly in the interview room.
7. Validate interview language and replace untyped report responses with a stable contract.

## Constraints
- No live AI calls or live interviews.
- No new dependency unless unavoidable.
- Do not merge directly into `develop`: privacy and deletion changes require a PR.
- Do not apply production migrations without the owner; record local/remote migration state.
- Keep commits coherent and update `runs/2026-09-23-interview-integrity-progress.md`
  after each checkpoint.

## Verification
- Web: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- API: `./gradlew ktlintCheck test build`.
- Add focused tests for every fixed race and failure path.
