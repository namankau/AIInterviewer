-- The loop brief: how this company interviews, before the round starts (PRD 04, 08, 09,
-- 10). Task 037.
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- Additive only: two new tables, nothing dropped or renamed. Applying this ahead of the
-- code that uses it breaks nothing -- the tables simply sit empty until the extractor
-- (bumped to EXTRACTOR_VERSION 3) and the general-pattern cache start writing to them.

-- ---------------------------------------------------------------------------
-- source_process_stages -- what a fetched document says an employer's loop looks like
--
-- One row per (source, employer, stage). A stage naming two employers becomes two rows,
-- the same shape source_questions takes for a question asked at two companies.
--
-- `evidence` is not optional and not decorative: it is the verbatim quote the engine
-- checked was really in the document before this row was ever written
-- (`ProcessStageVerifier`). A stage that failed that check does not reach this table at
-- all -- there is no "unverified" flag, because a candidate reading the brief cannot
-- tell an unverified claim from a verified one, so the product must never hold one.
--
-- `company_id` is set null rather than cascading on company deletion, the same choice
-- `source_questions.company_id` makes: removing a company removes a claim about who
-- runs this stage, not the evidence that a document described it.
-- ---------------------------------------------------------------------------

create table public.source_process_stages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.interview_sources (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  -- The name as the document gave it, kept alongside the resolved company so a wrong
  -- resolution can be seen and corrected, exactly as source_questions.company_name does.
  company_name text,
  role_family text,
  stage_order integer,
  stage_name text not null
    constraint source_process_stages_name_not_blank check (length(btrim(stage_name)) > 0),
  format text,
  duration_minutes integer
    constraint source_process_stages_duration_positive check (duration_minutes is null or duration_minutes > 0),
  assesses text,
  -- Null for a stage this product does not simulate: an online assessment, team
  -- matching, an offer conversation.
  round_type public.round_type,
  evidence text not null
    constraint source_process_stages_evidence_not_blank check (length(btrim(evidence)) > 0),
  created_at timestamptz not null default now()
);

create index source_process_stages_source_idx on public.source_process_stages (source_id);
create index source_process_stages_company_idx
  on public.source_process_stages (company_id, stage_order);

comment on table public.source_process_stages is
  'Loop stages a fetched document reports for a named employer, each with a verbatim '
  'evidence quote the engine checked really occurs in the document. Written only by '
  'ProcessStageWriter, from the same extraction call that reads questions.';

alter table public.source_process_stages enable row level security;
-- Operator data, read by the loop-brief endpoints as the database owner; no client
-- policy grants direct access, the same posture as companies and bank_questions.

-- ---------------------------------------------------------------------------
-- general_loop_patterns -- the cached, company-blind general pattern
--
-- Keyed on (archetype, role family, level), never on a company: the model that writes
-- this is never told which employer it is describing, so the same cached answer is
-- correct for every employer in that bucket, and caching it is what keeps the call
-- close to free. `role_family` and `level_band` are normalised by the API before they
-- reach this table, so "Backend Engineer" and "backend engineer" share one row.
-- ---------------------------------------------------------------------------

create table public.general_loop_patterns (
  id uuid primary key default gen_random_uuid(),
  archetype public.employer_archetype not null,
  role_family text not null
    constraint general_loop_patterns_role_not_blank check (length(btrim(role_family)) > 0),
  level_band text not null
    constraint general_loop_patterns_level_not_blank check (length(btrim(level_band)) > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint general_loop_patterns_unique unique (archetype, role_family, level_band)
);

create trigger general_loop_patterns_set_updated_at
before update on public.general_loop_patterns
for each row execute function public.set_updated_at();

comment on table public.general_loop_patterns is
  'The archetype-level loop pattern, cached per (archetype, role family, level band). '
  'Written by a model call that is never given the company''s name, so the cached '
  'answer can never carry a company-specific detail.';

alter table public.general_loop_patterns enable row level security;
-- Same posture: no client policy, read and written by the API as the database owner.
