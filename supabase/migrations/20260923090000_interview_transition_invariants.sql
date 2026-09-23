-- The entitlement read is not a lock. Let PostgreSQL arbitrate concurrent starts so
-- two requests can never create two active interviews for the same candidate.
create unique index sessions_one_open_per_user_idx
  on public.sessions (user_id)
  where status in ('created', 'in_progress');
