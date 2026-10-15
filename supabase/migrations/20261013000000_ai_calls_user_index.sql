-- Account deletion and per-user daily spend checks both locate AI ledger rows by owner.
-- Keep anonymous historical rows out of the index after account deletion.
create index if not exists ai_calls_user_occurred_idx
  on public.ai_calls (user_id, occurred_at desc)
  where user_id is not null;
