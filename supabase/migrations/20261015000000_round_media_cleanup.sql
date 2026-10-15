-- Answer recordings are no longer retained. Queue the existing media under terminal
-- rounds, and let the durable worker clear both old answer files and spoken questions.
alter table public.storage_deletion_jobs
  drop constraint storage_deletion_jobs_reason_check;

alter table public.storage_deletion_jobs
  add constraint storage_deletion_jobs_reason_check
  check (reason in ('candidate_deleted', 'retention_expired', 'account_deleted', 'round_finished'));

insert into public.storage_deletion_jobs
       (user_id, session_id, bucket, object_prefix, reason)
select user_id, id, 'interview-media', user_id::text || '/' || id::text, 'round_finished'
  from public.sessions
 where status in ('completed', 'abandoned', 'failed') and report_expired_at is null
on conflict (bucket, object_prefix) do update
   set completed_at = null,
       next_attempt_at = now(),
       settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
       reason = excluded.reason,
       updated_at = now();

update public.session_turns t
   set question_audio_path = null,
       question_audio_status = 'unavailable'::public.speech_status,
       answer_audio_path = null,
       answer_video_path = null
  from public.sessions s
 where t.session_id = s.id and t.user_id = s.user_id
   and s.status in ('completed', 'abandoned', 'failed');
