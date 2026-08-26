-- InterviewOS interview loop (PRD 06 engine, 09 feedback and scoring).
--
-- Owned by the Supabase CLI. Adds what task 002 needs on top of the task-001 schema:
-- the turns of a spoken interview, the report it produces, the media buckets those
-- turns live in, and the payment seam that gates the free tier. Nothing here is a
-- `targets` table — company and role still live on the session row (see the note at
-- the head of 20260825000000_initial_schema.sql).
--
-- Never edit an applied migration; add a new one.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- PRD 06: after each answer the engine chooses what the interviewer does next.
create type public.turn_next_action as enum (
  'follow_up',
  'probe',
  'challenge',
  'move_on',
  'raise_difficulty',
  'conclude'
);

-- The seam only ever sees these three in test mode. Live capture is the owner's call.
create type public.payment_status as enum ('created', 'paid', 'failed');

-- ---------------------------------------------------------------------------
-- session_turns — one question-and-answer exchange, persisted as it happens
--
-- A row is written the moment the interviewer poses a question (PRD 06: nothing about
-- a session may be lost to a refresh or a dropped connection), then updated in place
-- when the candidate's spoken answer arrives. user_id is denormalised from the parent
-- session so ownership and RLS need no join.
-- ---------------------------------------------------------------------------

create table public.session_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  -- The interviewer's side of the exchange.
  question_text text not null check (length(btrim(question_text)) > 0),
  question_audio_path text,
  -- The candidate's side, filled in when the answer is submitted.
  answer_transcript text,
  answer_audio_path text,
  answer_video_path text,
  answered_at timestamptz,
  -- Gemini's in-flight assessment of the answer, and the action it drove.
  assessment jsonb,
  next_action public.turn_next_action,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_turns_index_unique unique (session_id, turn_index),
  constraint session_turns_answer_consistency check (
    (answer_transcript is null) = (answered_at is null)
  )
);

create index session_turns_session_idx on public.session_turns (session_id, turn_index);

create trigger session_turns_set_updated_at
before update on public.session_turns
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- session_reports — the structured, evidence-backed feedback report (PRD 09)
--
-- One report per session. The payload is the whole report as the API returns it;
-- token counts are recorded because per-session cost is what decides pricing.
-- ---------------------------------------------------------------------------

create table public.session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  payload jsonb not null,
  model text,
  prompt_tokens integer check (prompt_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  generated_at timestamptz not null default now()
);

create index session_reports_user_idx on public.session_reports (user_id);

-- ---------------------------------------------------------------------------
-- payments — the Razorpay seam (PRD 10). Built, not armed.
--
-- Free tier is one complete interview including its report; after that, starting a new
-- session is gated. Entitlement is derived (completed sessions + captured payments),
-- not stored as a flag, so it cannot drift out of sync with reality.
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  amount_minor bigint check (amount_minor >= 0),
  currency char(3),
  status public.payment_status not null default 'created',
  plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_order_unique unique (provider, provider_order_id)
);

create index payments_user_status_idx on public.payments (user_id, status);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- As with the task-001 tables: the API connects as the database owner and enforces
-- ownership from the verified JWT subject, so these policies govern direct client
-- access through PostgREST. Turns and reports are written server-side only, so clients
-- get select-own and nothing else.
-- ---------------------------------------------------------------------------

alter table public.session_turns enable row level security;
alter table public.session_reports enable row level security;
alter table public.payments enable row level security;

create policy session_turns_select_own on public.session_turns
  for select to authenticated using ((select auth.uid()) = user_id);

create policy session_reports_select_own on public.session_reports
  for select to authenticated using ((select auth.uid()) = user_id);

create policy payments_select_own on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage — private, owner-only buckets for resumes and interview media
--
-- Objects are keyed as `{user_id}/...`, so ownership is the first path segment. The
-- API uploads and deletes with the service role (which bypasses RLS); these policies
-- protect the buckets against direct client access, and account deletion removes the
-- objects through the Storage API (see AccountService), not by row deletion alone.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false), ('interview-media', 'interview-media', false)
on conflict (id) do nothing;

create policy storage_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('resumes', 'interview-media')
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy storage_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('resumes', 'interview-media')
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy storage_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('resumes', 'interview-media')
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
