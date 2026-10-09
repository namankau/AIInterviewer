-- The interview clock starts when the candidate enters the room, not when setup creates
-- the session. Keep the existing started_at column for history/constraints; this explicit
-- latch replaces the brittle `started_at = created_at` inference used by startClock().
alter table public.sessions
  add column if not exists entered_at timestamptz;

comment on column public.sessions.entered_at is
  'First room entry. The scheduled interview deadline is derived from this timestamp.';
