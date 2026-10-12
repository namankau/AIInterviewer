-- One durable completion per candidate and local calendar day for the dashboard's
-- Question of the Day. The question itself is selected deterministically from the
-- reviewed Arena corpus; this table stores only the personal completion fact.

create table public.daily_question_completions (
  user_id uuid not null references public.users (id) on delete cascade,
  -- The candidate's calendar day, supplied by the browser for the same reason Arena
  -- streaks use a local date: midnight belongs to the learner, not the API server.
  local_date date not null,
  challenge_id text not null check (length(challenge_id) between 1 and 200),
  completed_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

comment on column public.daily_question_completions.local_date is
  'Local calendar date in the candidate''s own timezone. Never a UTC-derived date.';

alter table public.daily_question_completions enable row level security;

create policy daily_question_completions_select_own on public.daily_question_completions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy daily_question_completions_insert_own on public.daily_question_completions
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- No update or delete policy: a completed day is immutable. Account deletion removes
-- the rows through the owner foreign key's cascade.
