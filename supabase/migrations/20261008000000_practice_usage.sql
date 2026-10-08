-- The daily free-practice allowance (2 rounds and 60 minutes a day) is counted from this
-- ledger, not from public.sessions. A candidate may delete a round, and deleting it must
-- not hand the minutes back — otherwise "delete and start again" is unlimited practice.
--
-- So session_id is recorded but deliberately not a foreign key: the row outlives the round.
-- It does cascade from the account, because account deletion has to delete everything.
create table public.practice_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid not null,
  minutes integer not null check (minutes > 0),
  started_at timestamptz not null default now()
);

create index practice_usage_user_started_idx
  on public.practice_usage (user_id, started_at desc);

-- Server-only, like the other ledgers: the API reads and writes it with its own role and
-- scopes every query by the verified user. No client policy is granted.
alter table public.practice_usage enable row level security;

comment on table public.practice_usage is
  'One row per round started, for the daily free-practice allowance. Survives round deletion.';
