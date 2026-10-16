-- Authored scenario Arena. Legacy arena_cards/progress/badges and derived question content
-- remain intact for the dashboard and historical progress.
create table public.arena_courses (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  slug text not null unique,
  title text not null
);
create table public.arena_concepts (
  id text primary key,
  course_id text not null references public.arena_courses(id),
  name text not null,
  tier text not null check (tier in ('foundations','intermediate','advanced','expert')),
  prerequisite_concept_ids text[] not null default '{}',
  unique (course_id, name)
);
create table public.arena_scenarios (
  id text primary key,
  course_id text not null references public.arena_courses(id),
  slug text not null,
  title text not null,
  hook text not null,
  context text not null,
  tier text not null check (tier in ('foundations','intermediate','advanced','expert')),
  concept_ids text[] not null,
  estimated_minutes integer not null check (estimated_minutes between 1 and 60),
  status text not null check (status in ('draft','reviewed','live')),
  solution_brief text not null,
  unique (course_id, slug)
);
create table public.arena_scenario_steps (
  id text primary key,
  scenario_id text not null references public.arena_scenarios(id) on delete cascade,
  position integer not null check (position >= 1),
  kind text not null check (kind in ('initial','probe')),
  step_type text not null check (step_type in ('design_choice','algo_choice','complexity','predict_output','debug','tradeoff')),
  prompt text not null,
  context_note text,
  options jsonb not null,
  correct_option_id text not null,
  explanation text not null,
  bottleneck_note text not null,
  concept_ids text[] not null,
  code_snippet text,
  language text,
  unique (scenario_id, position),
  check (jsonb_typeof(options) = 'array'),
  check (kind = 'initial' or length(trim(coalesce(context_note,''))) > 0)
);
create index arena_scenarios_course_live_idx on public.arena_scenarios(course_id, tier) where status = 'live';

create table public.user_scenario_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null references public.arena_scenarios(id),
  course_id text not null references public.arena_courses(id),
  current_step_id text references public.arena_scenario_steps(id),
  status text not null check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, scenario_id)
);
create unique index user_scenario_one_active_course_idx
  on public.user_scenario_progress(user_id, course_id) where status = 'in_progress';
create table public.user_step_answers (
  user_id uuid not null references public.users(id) on delete cascade,
  step_id text not null references public.arena_scenario_steps(id),
  chosen_option_id text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, step_id)
);
create table public.user_concept_mastery (
  user_id uuid not null references public.users(id) on delete cascade,
  concept_id text not null references public.arena_concepts(id),
  score numeric(5,4) not null default 0.5 check (score between 0 and 1),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);
create index user_scenario_progress_course_idx on public.user_scenario_progress(user_id, course_id, status);

alter table public.arena_courses enable row level security;
alter table public.arena_concepts enable row level security;
alter table public.arena_scenarios enable row level security;
alter table public.arena_scenario_steps enable row level security;
alter table public.user_scenario_progress enable row level security;
alter table public.user_step_answers enable row level security;
alter table public.user_concept_mastery enable row level security;
-- Content is served through the authenticated API, which omits answer keys until grading.
-- No direct client policies for content or progress: API derives identity from the JWT.
