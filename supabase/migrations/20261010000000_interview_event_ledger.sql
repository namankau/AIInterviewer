-- Privacy-safe, durable interview operations ledger (PRD 06, 12).
--
-- This is deliberately metadata, never interview evidence: no question, transcript,
-- recording, prompt, model output, URL, email, exception message or arbitrary JSON.
create table public.interview_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  turn_index integer check (turn_index is null or turn_index >= 0),
  request_id uuid,
  event_type text not null check (event_type in (
    'room_entered',
    'client_phase_changed', 'client_heartbeat', 'client_page_hidden',
    'answer_submission_started', 'answer_submission_failed', 'answer_submission_slow',
    'browser_speech_failed', 'browser_speech_timed_out', 'question_audio_poll_timed_out',
    'model_audio_play_rejected', 'model_audio_error', 'model_audio_stalled', 'model_audio_timed_out',
    'answer_request_claimed', 'answer_storage_started', 'answer_storage_finished',
    'answer_assessment_started', 'answer_assessment_succeeded', 'answer_assessment_failed',
    'answer_persist_started', 'answer_persist_succeeded', 'answer_persist_failed',
    'answer_response_ready', 'interviewer_decision',
    'provider_attempt_started', 'provider_attempt_succeeded', 'provider_attempt_failed', 'provider_fallback',
    'question_speech_started', 'question_speech_succeeded', 'question_speech_failed',
    'question_speech_state_write_failed',
    'session_completed', 'session_abandoned', 'session_failed'
  )),
  phase text check (phase is null or phase in (
    'loading', 'checking', 'asking', 'answering', 'submitting',
    'closing', 'complete', 'terminal', 'error'
  )),
  provider text check (provider is null or char_length(provider) between 1 and 120),
  operation text check (operation is null or operation in (
    'assessAnswer', 'composeOpeningQuestion', 'composeProblem', 'composeCase',
    'synthesizeSpeech', 'offerHint', 'composeReport'
  )),
  outcome text check (outcome is null or outcome in (
    'started', 'succeeded', 'failed', 'timed_out', 'fallback', 'ready', 'unavailable'
  )),
  error_type text check (error_type is null or error_type in (
    'ai_unavailable', 'storage_unavailable', 'database_write_failed', 'request_failed',
    'client_timeout', 'browser_media_error', 'unknown'
  )),
  action text check (action is null or action in (
    'follow_up', 'probe', 'challenge', 'move_on', 'raise_difficulty',
    'redirect', 'hint', 'guide', 'conclude'
  )),
  intervention text check (intervention is null or intervention in (
    'none', 'redirected', 'hinted', 'guided', 'corrected'
  )),
  duration_ms bigint check (duration_ms is null or duration_ms between 0 and 86400000)
);

comment on table public.interview_events is
  'Content-free operational timeline for diagnosing live interview stalls. Service-role/operator access only.';
comment on column public.interview_events.user_id is
  'Owner copied onto every event for account deletion and bounded operator lookup.';

create index interview_events_session_timeline_idx
  on public.interview_events (session_id, occurred_at, id);
create index interview_events_request_timeline_idx
  on public.interview_events (request_id, occurred_at)
  where request_id is not null;
create index interview_events_user_timeline_idx
  on public.interview_events (user_id, occurred_at desc);
create index interview_events_retention_idx
  on public.interview_events (occurred_at);

alter table public.interview_events enable row level security;

-- Intentionally no candidate policy. The API writes with its server credential and the
-- admin-gated API is the only read path. A candidate must not be able to turn internal
-- provider/failure metadata into a new public endpoint through the Supabase client.
