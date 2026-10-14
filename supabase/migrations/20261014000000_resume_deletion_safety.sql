-- The browser uses the versioned API for all writes. Remove the old Data API write
-- surface, including policies on user-owned rows whose columns contain storage keys.
drop policy if exists users_update_own on public.users;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists resumes_insert_own on public.resumes;
drop policy if exists resumes_update_own on public.resumes;
drop policy if exists resumes_delete_own on public.resumes;
drop policy if exists skills_insert_own on public.skills;
drop policy if exists skills_update_own on public.skills;
drop policy if exists skills_delete_own on public.skills;
drop policy if exists arena_progress_insert_own on public.arena_progress;
drop policy if exists arena_progress_update_own on public.arena_progress;
drop policy if exists arena_badges_insert_own on public.arena_badges;
drop policy if exists arena_cards_insert_own on public.arena_cards;
drop policy if exists arena_cards_update_own on public.arena_cards;
drop policy if exists course_progress_insert_own on public.course_progress;
drop policy if exists course_progress_delete_own on public.course_progress;
drop policy if exists daily_question_completions_insert_own on public.daily_question_completions;
drop policy if exists storage_owner_insert on storage.objects;
drop policy if exists storage_owner_delete on storage.objects;

-- Supabase grants table privileges separately from RLS policies. Revoke both roles'
-- unused write privileges on every public table, not just the tables listed above.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon, authenticated;

-- Resume jobs name one exact object and do not belong to a session. They share the
-- retryable outbox with round and account deletion.
alter table public.storage_deletion_jobs drop constraint storage_deletion_jobs_reason_check;
alter table public.storage_deletion_jobs add constraint storage_deletion_jobs_reason_check
  check (reason in ('candidate_deleted', 'retention_expired', 'account_deleted', 'resume_deleted'));
alter table public.storage_deletion_jobs drop constraint storage_deletion_jobs_session_scope_check;
alter table public.storage_deletion_jobs add constraint storage_deletion_jobs_session_scope_check
  check (reason in ('account_deleted', 'resume_deleted') or session_id is not null);
