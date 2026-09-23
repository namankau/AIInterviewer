-- Storage objects do not participate in PostgreSQL transactions. Keep a durable job
-- outside the session foreign-key tree so cleanup survives deletion of both the round
-- and, later, the owning account.
create table public.storage_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  bucket text not null,
  object_prefix text not null,
  reason text not null check (reason in ('candidate_deleted', 'retention_expired')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  settle_after timestamptz not null default (now() + interval '15 minutes'),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_prefix)
);

create index storage_deletion_jobs_due_idx
  on public.storage_deletion_jobs (next_attempt_at, created_at)
  where completed_at is null;

alter table public.storage_deletion_jobs enable row level security;

comment on table public.storage_deletion_jobs is
  'Server-only durable outbox for deleting candidate interview media from object storage.';
