-- Account deletion reuses the storage deletion outbox (20260923110000), which was kept
-- outside the user foreign-key tree for exactly this: the jobs that remove an account's
-- recordings, resumes and photo must survive the cascade that removes the account.
--
-- An account-level job covers every object under the user's prefix, so it has no session.
alter table public.storage_deletion_jobs
  alter column session_id drop not null;

alter table public.storage_deletion_jobs
  drop constraint storage_deletion_jobs_reason_check;

alter table public.storage_deletion_jobs
  add constraint storage_deletion_jobs_reason_check
  check (reason in ('candidate_deleted', 'retention_expired', 'account_deleted'));

-- Only an account-level job may omit the session; a round's job still names its round.
alter table public.storage_deletion_jobs
  add constraint storage_deletion_jobs_session_scope_check
  check (reason = 'account_deleted' or session_id is not null);
