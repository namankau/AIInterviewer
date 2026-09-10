-- Deleting a round, and letting reports expire (PRD 12: data rights and retention).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- Two things arrive here, and they are the same operation seen from two directions.
--
-- The candidate can now delete a past round outright. Nothing schema-level is needed for
-- that: `session_turns.session_id` and `session_reports.session_id` already cascade from
-- `public.sessions`, so one scoped `delete from public.sessions` takes the transcript and
-- the report with it. That cascade is load-bearing now rather than decorative --
-- RoundDeletion relies on it, and a future child table of `sessions` that does not
-- declare `on delete cascade` will leave a candidate's answers behind after they asked
-- for them to be destroyed. Declare it.
--
-- The other direction is time. A report is kept for four weeks and then cleared, along
-- with the transcript it was written from and the audio it was recorded from. What is
-- kept is the session row itself, and that is the whole point of the column below: the
-- candidate's history is derived from completed sessions (CLAUDE.md), so throwing the
-- row away would quietly rewrite how much practice they have done. The round stays as a
-- line in their history; the evidence behind it does not.
--
-- `report_expired_at` therefore means "everything under this round has been cleared".
-- It is not "the report has not been generated yet" -- that is `session_reports` being
-- absent, which is an ordinary state for a round nobody has opened. The two have to be
-- distinguishable, because one of them means "open it and we will write it" and the
-- other means "there is nothing left to write it from".

alter table public.sessions
  add column report_expired_at timestamptz;

comment on column public.sessions.report_expired_at is
  'When retention cleared this round''s report, transcript and recordings. Null means '
  'nothing has been cleared. Distinct from having no session_reports row, which merely '
  'means the report has not been composed yet.';

-- What the retention job scans. Partial on the null, because a round is only ever a
-- candidate for expiry once, and after that it must stop being looked at: without the
-- predicate this index would grow with every round ever sat and be read on every pass.
--
-- `coalesce(ended_at, created_at)` is the round's age. A session that never reached
-- `ended_at` -- one abandoned by closing the tab -- still holds uploaded audio, and
-- leaving it out of retention would mean the recordings most likely to be forgotten are
-- the ones kept for ever. A round runs for at most two hours, so a session older than
-- the retention window is finished whatever its status column says.
create index sessions_report_expiry_idx
  on public.sessions (coalesce(ended_at, created_at))
  where report_expired_at is null;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Deliberately unchanged, and worth saying why rather than leaving the absence to be
-- read as an oversight.
--
-- `public.sessions`, `public.session_turns` and `public.session_reports` grant clients
-- select-own and nothing else, because all interview logic is server-side (CLAUDE.md).
-- Deletion is interview logic too: it destroys storage objects that no SQL policy can
-- reach, and getting only the rows would leave a candidate's audio in a bucket after
-- they had been told their round was gone. A `sessions_delete_own` policy would be a
-- second, quieter route to a half-finished deletion, so there is not one. The candidate
-- deletes through `DELETE /api/v1/sessions/{id}`, which is scoped by the verified token
-- subject and removes the objects as well as the rows.
-- ---------------------------------------------------------------------------
