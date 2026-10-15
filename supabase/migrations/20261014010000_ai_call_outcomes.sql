-- A response that contains unusable JSON is still billed. Timeouts may also have
-- completed at the provider while the client waited. Keep both visible in the ledger
-- rather than letting the success-only total understate spend during failures.
alter table public.ai_calls
  add column outcome text not null default 'succeeded'
    check (outcome in ('succeeded', 'failed')),
  add column usage_estimated boolean not null default false;

