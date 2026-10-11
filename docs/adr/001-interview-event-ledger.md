# ADR 001: Durable interview event ledger

Status: accepted, 10 October 2026

## Decision

Live interview diagnosis uses an append-only PostgreSQL event ledger in the existing
Supabase database. Each row carries the candidate owner, session, optional turn and
idempotency request identifiers, a fixed event type, and bounded operational metadata.
Writes run in independent transactions and are best effort: a failed telemetry insert
must never roll back or stop an interview.

The browser reports phase transitions, answer-submission start/failure, page hiding and
a heartbeat every 30 seconds while the room is active. The server records answer storage,
assessment, persistence and response milestones, provider attempts/fallbacks, speech,
the engine's normalized action/intervention decision, and terminal session state.
The decision is a fixed enum, never the candidate answer, model explanation or next
question. Together, the last event and its timestamp distinguish a
closed tab from a request stuck in a provider, storage or database stage and give a
defensible observed interview duration.

`answer_submission_started` is the browser's evidence that browser-to-API ingress began.
The server cannot truthfully mark multipart ingress start because Spring calls the
controller only after parsing it. Its `answer_request_claimed` is therefore the first
server-side receipt marker, while `answer_storage_*` refers only to the later object-store
copy of the already received audio.

Operators query one session UUID at a time through an `AdminAccess`-gated endpoint. The
response is capped at the 500 most recent events, returned chronologically. It exposes
the opaque user UUID needed for account support, not an email or profile. There is no
list-all or free-text search.

## Privacy and truthfulness boundary

The ledger must never contain question text, transcripts, recordings, résumé data,
prompts/model output, signed URLs, authorization values, emails, names, exception
messages, stack traces or arbitrary client fields. Event, phase, operation, outcome and
error classification are fixed vocabularies enforced by both application code and SQL.
Provider is bounded to 120 characters and comes only from server configuration.

The timeline says what the software did, not what the candidate said or how well they
performed. A heartbeat proves only that the room code was running and able to reach the
API; it does not prove continuous candidate presence.

## Retention, deletion and access

Events use the same 28-day default window as interview evidence and are purged by a
scheduled bounded delete. `user_id` and `session_id` both cascade on deletion, so account
or individual-session deletion removes the timeline immediately. Report-expiry keeps the
session shell and therefore keeps operational events only until their independent
28-day age purge; it does not extend them.

RLS is enabled with no candidate policy. Only the API's server database identity can
write or read. Operator reads require the existing verified admin allow-list. Database,
API and log access remain restricted to operators and should be audited by the hosting
platform.

## Consequences

This works before a log aggregation vendor is selected and survives API restarts and
transaction rollback. It adds small writes to the primary database, bounded by fixed
retention and a 500-row incident view. Because writes are intentionally best effort, a
database outage can create gaps; ordinary structured logs remain a secondary signal.
The browser cannot report after a hard crash or network loss, so the last heartbeat is
an upper/lower-bound clue rather than proof of the exact disconnect instant.
