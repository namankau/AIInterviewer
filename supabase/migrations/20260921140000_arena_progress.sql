-- Arena progress, tied to the account rather than the browser (task 055).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- The same problem course progress had: XP, streaks, badges and the spaced-repetition
-- schedule all lived in `localStorage`, so none of it followed a candidate to a second
-- device or a lab machine, and none of it went away when they signed out of a shared one.
--
-- Three tables rather than one JSON document. A card is rewritten on *every answered
-- challenge*, and a blob would mean reading and rewriting all ~800 of them each time;
-- separate rows also let Postgres enforce the shape instead of trusting whatever the
-- client last serialised.

-- ---------------------------------------------------------------------------
-- The counters: one row per candidate.
-- ---------------------------------------------------------------------------
create table public.arena_progress (
  user_id uuid primary key references public.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  streak_current integer not null default 0 check (streak_current >= 0),
  streak_longest integer not null default 0 check (streak_longest >= 0),
  -- The candidate's own calendar date, in their timezone, when they last practised.
  -- A date, not a timestamp: a streak is a question about days, and storing an instant
  -- would invite somebody to recompute the day in UTC and break the boundary at 05:30 IST.
  last_active_date date,
  updated_at timestamptz not null default now()
);

comment on column public.arena_progress.last_active_date is
  'Local calendar date in the candidate''s own timezone, decided client-side. Never a UTC date.';

-- ---------------------------------------------------------------------------
-- Badges: one row per badge actually earned.
-- ---------------------------------------------------------------------------
create table public.arena_badges (
  user_id uuid not null references public.users (id) on delete cascade,
  -- Matches an id in BADGES in `apps/web/src/lib/arena/progression.ts`. The API checks
  -- membership before insert, so an arbitrary string cannot be stored.
  badge_id text not null check (length(badge_id) between 1 and 100),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ---------------------------------------------------------------------------
-- One FSRS card per challenge the candidate has answered.
--
-- Mirrors `ReviewState` in `apps/web/src/lib/arena/scheduler.ts`. `mastered` replaces the
-- separate list of mastered challenge ids that the browser version kept: it is the same
-- fact about the same challenge, and one row cannot disagree with itself.
-- ---------------------------------------------------------------------------
create table public.arena_cards (
  user_id uuid not null references public.users (id) on delete cascade,
  -- A derived challenge id, stable across rebuilds (see `deriveChallenges`).
  challenge_id text not null check (length(challenge_id) between 1 and 200),
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  -- ts-fsrs `State`: 0 New, 1 Learning, 2 Review, 3 Relearning.
  state smallint not null check (state between 0 and 3),
  last_review timestamptz,
  -- Answered correctly at least once. A single right answer counts, as it did in the
  -- browser version -- mastery does not require a flawless sitting.
  mastered boolean not null default false,
  primary key (user_id, challenge_id)
);

-- Picking a session asks "what is due for this candidate", so the due date leads.
create index arena_cards_due_idx on public.arena_cards (user_id, due);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Personal data with an owner column, so it gets RLS like every other such table. These
-- policies govern direct client access through Supabase (PostgREST). The API connects as
-- the database owner and enforces ownership itself from the verified JWT subject.
--
-- No delete policy: a candidate does not un-earn a badge or un-answer a challenge, and
-- clearing progress wholesale is not a feature that exists. Account deletion is handled by
-- the cascade above, which is not subject to these policies.
-- ---------------------------------------------------------------------------
alter table public.arena_progress enable row level security;
alter table public.arena_badges enable row level security;
alter table public.arena_cards enable row level security;

create policy arena_progress_select_own on public.arena_progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy arena_progress_insert_own on public.arena_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy arena_progress_update_own on public.arena_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy arena_badges_select_own on public.arena_badges
  for select to authenticated using ((select auth.uid()) = user_id);

create policy arena_badges_insert_own on public.arena_badges
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy arena_cards_select_own on public.arena_cards
  for select to authenticated using ((select auth.uid()) = user_id);

create policy arena_cards_insert_own on public.arena_cards
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy arena_cards_update_own on public.arena_cards
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
