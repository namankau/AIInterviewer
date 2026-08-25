-- InterviewOS initial schema (PRD 05: candidate profile model).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push` (hosted) or
-- `npm run db:reset` (local stack). The API does not run migrations.
--
-- Deliberately absent: a `targets` table. Company and role are named at the start of
-- each session and live on the session row; progress views are derived by grouping
-- completed sessions by (company_name, role_title). See PRD 05, "why there is no
-- stored target list". Do not add one.
--
-- Enum types are used only for the closed sets the PRD actually enumerates.
-- Open sets that a taxonomy will own later (function, level, company name) are text.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- PRD 05: English / Hindi-English code-switched / regional (regional arrives later).
create type public.interview_language as enum ('english', 'hindi_english', 'regional');

-- PRD 03: employer archetypes. Archetype determines round structure and evaluation.
create type public.employer_archetype as enum (
  'global_product',
  'indian_product',
  'service_based_it',
  'consulting_big_four',
  'european_employer',
  'gcc_captive',
  'regulated_professional',
  'industrial_manufacturing'
);

-- PRD 06: round types supported.
create type public.round_type as enum (
  'technical_fundamentals',
  'project_deep_dive',
  'coding_practical',
  'system_design',
  'case_client_scenario',
  'techno_managerial',
  'behavioural_competency',
  'hr_fit_closing'
);

create type public.session_status as enum ('created', 'in_progress', 'completed', 'abandoned', 'failed');

create type public.resume_parse_status as enum ('pending', 'processing', 'parsed', 'failed');

create type public.relocation_intent as enum ('not_open', 'open_within_country', 'open_internationally');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — identity and access (PRD 05)
--
-- id is the Supabase auth user id. The API never trusts a user id sent by a client;
-- it is always taken from the verified JWT subject.
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  preferred_language public.interview_language not null default 'english',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles — function/level and the context that drives HR-fit rounds (PRD 05)
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  function text,
  current_level text,
  target_level text,
  total_experience_months integer check (total_experience_months >= 0),
  people_management_scope text,
  location text,
  relocation_intent public.relocation_intent,
  work_authorisation_status text,
  notice_period_days integer check (notice_period_days >= 0),
  -- "compensation expectation band" is stored as an explicit range so notice,
  -- relocation and compensation conversations can be rehearsed with real numbers.
  compensation_expectation_min numeric(12, 2) check (compensation_expectation_min >= 0),
  compensation_expectation_max numeric(12, 2) check (compensation_expectation_max >= 0),
  compensation_currency char(3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_compensation_band_ordered check (
    compensation_expectation_min is null
    or compensation_expectation_max is null
    or compensation_expectation_max >= compensation_expectation_min
  )
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- resumes — parsing itself is a later task; this stores the object and its status
-- ---------------------------------------------------------------------------

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  storage_bucket text not null default 'resumes',
  storage_path text not null,
  original_filename text not null,
  content_type text,
  size_bytes bigint check (size_bytes >= 0),
  parse_status public.resume_parse_status not null default 'pending',
  parse_error text,
  parsed_payload jsonb,
  uploaded_at timestamptz not null default now(),
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resumes_storage_object_unique unique (storage_bucket, storage_path)
);

create index resumes_user_id_uploaded_at_idx on public.resumes (user_id, uploaded_at desc);

create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- skills — self-declared, reconciled against the resume (PRD 05)
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  self_rated_confidence smallint check (self_rated_confidence between 1 and 5),
  detected_in_resume boolean not null default false,
  flagged_as_weak boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per skill per user, case-insensitively.
create unique index skills_user_id_name_key on public.skills (user_id, lower(name));

create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions — one company and one role per session, chosen at session start
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_name text not null check (length(btrim(company_name)) > 0),
  company_archetype public.employer_archetype not null,
  role_title text not null check (length(btrim(role_title)) > 0),
  round_type public.round_type not null,
  language public.interview_language not null,
  status public.session_status not null default 'created',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_ended_requires_started check (ended_at is null or started_at is not null),
  constraint sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

-- Supports the derived progress view: completed sessions grouped by company and role.
create index sessions_user_company_role_idx on public.sessions (user_id, company_name, role_title);
create index sessions_user_id_created_at_idx on public.sessions (user_id, created_at desc);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Every table here holds personal data and has an owner column, so every table gets
-- RLS. These policies govern direct client access through Supabase (PostgREST). The
-- API connects as the database owner and enforces ownership itself from the verified
-- JWT subject, so it is not constrained by these policies.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.skills enable row level security;
alter table public.sessions enable row level security;

create policy users_select_own on public.users
  for select to authenticated using ((select auth.uid()) = id);

create policy users_update_own on public.users
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy resumes_select_own on public.resumes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy resumes_insert_own on public.resumes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy resumes_update_own on public.resumes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy resumes_delete_own on public.resumes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy skills_select_own on public.skills
  for select to authenticated using ((select auth.uid()) = user_id);

create policy skills_insert_own on public.skills
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy skills_update_own on public.skills
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy skills_delete_own on public.skills
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy sessions_select_own on public.sessions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Sessions are composed and scored server-side (CLAUDE.md: all interview logic is
-- server-side), so clients get no direct insert or update path.
