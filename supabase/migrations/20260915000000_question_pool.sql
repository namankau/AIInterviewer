-- The hidden AI question pool (PRD 03 knowledge tiers, 04 provenance, 08 archetypes).
-- Task 039.
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- WHY THIS IS NOT A COLUMN ON `bank_questions`
--
-- `bank_questions` holds questions a fetched document says a real employer asked, and its
-- company tags are *derived* from those documents (`bank_question_tags`) rather than
-- written. That is the one rule the bank exists to keep: every tag is backed by a page a
-- candidate can open.
--
-- Everything in this file is the opposite kind of thing. A pool question is a model's own
-- knowledge, written by a generation job, corroborated by nobody. It is useful -- for most
-- employers there is no published source at all, and the alternative is composing a
-- question live in the silence after the candidate's last answer -- but it is model
-- knowledge, and it has to be labelled as model knowledge for ever.
--
-- Keeping it here, in its own table, is what makes that structural rather than diligent. A
-- nullable `source_id` or an `is_generated` flag on `bank_questions` would have left one
-- forgotten `where` clause between a generated question and a sourced company tag, and the
-- day somebody forgot it the product would be asserting, with a citation, that Amazon asks
-- a question a model invented. There is no code path from this table into that one. The
-- pool is read by a round when the bank has nothing, and by nothing else -- it is never
-- listed in the UI (see task 042).
--
-- Additive only: new types, new tables, one new nullable column on `ai_calls`, and a
-- defensive re-seed of `companies` that conflicts away to nothing.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- How a pool question is allowed to relate to a named employer. **This is the whole
-- provenance gate in one column.**
--
--   company_specific  the model was asked, separately and first, whether it actually knows
--                     this employer's process, and answered yes with specifics -- named
--                     rounds, named values, a named format. That answer is stored on the
--                     row (`knowledge_basis`) so the claim can be read back and argued
--                     with. Even then the question is still model knowledge, not a report.
--
--   employer_kind     everything else. The question was written for the *archetype*. The
--                     row may still carry a `company_id` so a round can find it quickly,
--                     but what the candidate is told talks about the kind of employer --
--                     "loops like this one usually..." -- and never about the company.
--
-- The default is the safe one, and the Kotlin enforces it on the way in rather than
-- trusting the prompt: a generator that returns `company_specific` for a company the model
-- has just said it does not know is downgraded here, and the downgrades are counted in the
-- run report.
create type public.pool_association as enum ('company_specific', 'employer_kind');

-- PRD wave-1 role families. Engineering only: a new function vertical (PM, consulting, CA)
-- needs a rubric and a persona built with domain input first (CLAUDE.md), and adding a
-- value here before that exists would let the job generate questions nothing can score.
create type public.role_family as enum (
  'backend',
  'fullstack_frontend',
  'mobile',
  'qa_automation',
  'data_engineering',
  'ml_ai',
  'sre'
);

create type public.experience_level as enum ('entry', 'mid', 'senior', 'staff');

-- `paused` is not a failure. It is what the spend cap does: the run stops before the call
-- that would exceed its budget, keeps every cell it has finished, and waits to be resumed.
create type public.pool_run_status as enum ('running', 'paused', 'finished', 'failed');

-- `skipped` is a cell the job decided not to spend on (the model said it does not know the
-- employer and the archetype cell was already covered), which is different from `failed`.
create type public.pool_cell_status as enum ('pending', 'in_progress', 'done', 'skipped', 'failed');

-- ---------------------------------------------------------------------------
-- pool_generation_runs -- one row per attempt at filling some of the pool
-- ---------------------------------------------------------------------------

create table public.pool_generation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.pool_run_status not null default 'running',
  -- Which generator wrote this run's questions. Bumped when a generator's prompt changes
  -- enough that its output is no longer comparable with what came before, so a later
  -- review can tell "the old prompt wrote this" from "the new one did".
  generator_version integer not null default 1,
  -- Millionths of a US dollar, matching `ai_calls.micro_usd`. Integer for the same reason:
  -- this is summed, and floating-point drift in a budget is a bug found after the money is
  -- gone.
  spend_cap_micro_usd bigint not null check (spend_cap_micro_usd >= 0),
  -- A cache of `sum(ai_calls.micro_usd) where pool_run_id = this run`, updated as the job
  -- goes. The ledger is the truth; this column is so the admin status endpoint is one read.
  spent_micro_usd bigint not null default 0 check (spent_micro_usd >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pool_generation_runs_set_updated_at
before update on public.pool_generation_runs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pool_generation_cells -- the unit of work, and the reason the job is resumable
--
-- One row per (run, company, round type, role family, level), written up front in
-- `pending`. The job only ever picks up `pending` cells and marks them as it finishes, so a
-- process killed halfway -- by a usage limit, a deploy, a spend cap -- restarts by asking
-- for pending cells again. Nothing is generated twice and nothing is silently skipped.
-- ---------------------------------------------------------------------------

create table public.pool_generation_cells (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pool_generation_runs (id) on delete cascade,
  -- Nullable for the same reason as on `pool_questions`: a cell may be archetype-level.
  company_id uuid references public.companies (id) on delete cascade,
  archetype public.employer_archetype not null,
  round_type public.round_type not null,
  role_family public.role_family not null,
  level public.experience_level not null,
  status public.pool_cell_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  questions_written integer not null default 0 check (questions_written >= 0),
  duplicates_dropped integer not null default 0 check (duplicates_dropped >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pool_generation_cells_set_updated_at
before update on public.pool_generation_cells
for each row execute function public.set_updated_at();

-- One cell per coordinate per run. `company_id` is nullable and null is distinct from null
-- in a plain unique index, which would let a run hold two identical archetype-level cells
-- and generate the same questions twice -- so the index is on a coalesced id instead.
create unique index pool_generation_cells_coordinate_idx
  on public.pool_generation_cells (
    run_id,
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    round_type,
    role_family,
    level
  );

-- What the driver asks for on every iteration: the next pending cell in this run.
create index pool_generation_cells_pending_idx
  on public.pool_generation_cells (run_id, status, created_at);

-- ---------------------------------------------------------------------------
-- pool_questions -- the pool itself
-- ---------------------------------------------------------------------------

create table public.pool_questions (
  id uuid primary key default gen_random_uuid(),

  -- Nullable: a question generated for an archetype rather than for a named employer.
  -- Deleting a company deletes its pool questions, because a pool row's only reason to
  -- carry a company is so a round can find it, and a company nobody can name is not
  -- findable. The archetype-level rows are untouched and keep the fallback working.
  company_id uuid references public.companies (id) on delete cascade,

  -- Not null, always, even when `company_id` is set. This is what makes the archetype-level
  -- fallback total: whatever a round is looking for, there is a kind-of-employer answer.
  archetype public.employer_archetype not null,

  round_type public.round_type not null,
  role_family public.role_family not null,
  level public.experience_level not null,

  text text not null
    constraint pool_questions_text_not_blank check (length(btrim(text)) > 0),

  -- Where the interviewer goes next. Two or three, because one is not a follow-up plan and
  -- more than three is a script -- and empty is the failure this check exists to stop: a
  -- pool question with nowhere to go turns into the interviewer asking the same thing
  -- twice, which is exactly what the pool was built to fix.
  -- `array_length` is null for an empty array, and a check constraint that evaluates to
  -- null *passes* -- so the emptiness has to be excluded explicitly or `'{}'` sails through
  -- the very constraint written to stop it.
  follow_ups text[] not null
    constraint pool_questions_follow_ups_sized
      check (
        array_length(follow_ups, 1) is not null
        and array_length(follow_ups, 1) between 2 and 3
      ),

  -- What a strong answer would get across. Used to score, and to tell the candidate what
  -- they missed. Allowed to be empty for a round type where it does not apply, but never
  -- null, so nothing has to distinguish "none" from "not recorded".
  strong_answer_covers text[] not null default '{}',

  association public.pool_association not null default 'employer_kind',

  -- What the model said when it was asked, before any question was written, whether it
  -- actually knows this employer's interview process. Stored verbatim so the claim behind
  -- a `company_specific` row can be read and disputed. Null on an `employer_kind` row that
  -- was never company-specific to begin with.
  knowledge_basis text,

  -- A `company_specific` row must carry the answer that earned it. There is no way to
  -- write the stronger label without also writing the evidence for it.
  constraint pool_questions_company_specific_is_justified
    check (
      association <> 'company_specific'
      or (company_id is not null and knowledge_basis is not null and length(btrim(knowledge_basis)) > 0)
    ),

  generator_version integer not null,
  -- Which model wrote it. `ai_calls` says what the generation cost; this says what produced
  -- the row, and the two are different questions -- a cell regenerated after a fall-through
  -- was written by the expensive model, and a review of the pool's quality needs to know.
  model text not null
    constraint pool_questions_model_not_blank check (length(btrim(model)) > 0),

  -- Computed by the database from `text`, using the same function the bank uses, so a pool
  -- row can never carry a fingerprint that disagrees with its own wording and "the same
  -- question" means one thing across both tables. That shared definition is what lets the
  -- deduplicator drop a pool question that reproduces a sourced one.
  fingerprint text generated always as (public.question_fingerprint(text)) stored,

  reviewed_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pool_questions_fingerprint_not_empty check (fingerprint <> '')
);

create trigger pool_questions_set_updated_at
before update on public.pool_questions
for each row execute function public.set_updated_at();

-- The lookup a round makes (task 042): everything live for this company, round, role and
-- level. Partial on `retired_at is null` because a retired question is never served and
-- there is no query that wants one mixed in.
create index pool_questions_lookup_idx
  on public.pool_questions (company_id, round_type, role_family, level)
  where retired_at is null;

-- The archetype-level fallback, which is the query that runs for every employer nobody has
-- generated for by name -- that is most of them, so it gets its own index rather than
-- sharing one whose leading column is null.
create index pool_questions_archetype_lookup_idx
  on public.pool_questions (archetype, round_type, role_family, level)
  where retired_at is null;

-- Cheap exact-duplicate check, per company and round. Not unique: the same question is
-- legitimately in the pool for `backend` and for `sre`, or for two levels, and collapsing
-- those would leave a cell short. The deduplicator scopes its own check.
create index pool_questions_fingerprint_idx
  on public.pool_questions (fingerprint);

-- ---------------------------------------------------------------------------
-- Embeddings -- best effort, because the extension may not be ours to create
--
-- Fingerprints catch a question rewritten with different punctuation. They do not catch
-- "Tell me about a time you disagreed with your manager" against "Describe a disagreement
-- you had with your manager", which is the duplicate a generation job actually produces,
-- over and over, because it is being asked the same thing sixty times with a different
-- company name in the prompt. That needs embeddings.
--
-- pgvector is a standard Supabase extension, but creating an extension needs a privilege
-- this migration may not have on every plan, and a vector column with no extension behind
-- it is a column nothing can read. So: try, and if it cannot be done, warn loudly, skip the
-- column, and leave the pool deduplicating on fingerprints alone. `PoolDeduplicator` asks
-- the catalogue whether the column exists rather than assuming, so it degrades with this
-- instead of failing against it.
--
-- Dimension 768 is a deliberate truncation of `gemini-embedding-001`'s native 3072. It is
-- one of the Matryoshka lengths Google publishes for that model, it is a quarter of the
-- storage and of the distance arithmetic, and -- unlike 3072 -- it is under pgvector's
-- 2000-dimension ceiling for an hnsw or ivfflat index, so the column stays indexable if the
-- pool ever grows past a scan.
--
-- No ANN index is created here, and that is on purpose rather than pending. Dedupe queries
-- are scoped to one company and round type, which is tens of rows; an approximate index
-- would add nothing to the speed and would cost recall, and a duplicate check that
-- sometimes misses is worse than no index at all. An exact scan over a small scoped set is
-- the correct plan. When the pool is large enough for that to stop being true, add hnsw --
-- the dimension was chosen so that remains possible.
-- ---------------------------------------------------------------------------

do $$
declare
  vector_schema text;
begin
  select n.nspname
    into vector_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'vector';

  if vector_schema is null then
    begin
      execute 'create extension vector with schema public';
      vector_schema := 'public';
    exception
      when others then
        raise warning
          'pgvector could not be enabled (%): the question pool will deduplicate on '
          'fingerprints only. Enable the `vector` extension and re-run this block to add '
          'pool_questions.embedding.', sqlerrm;
    end;
  end if;

  if vector_schema is not null then
    execute format(
      'alter table public.pool_questions add column embedding %I.vector(768)',
      vector_schema
    );
    execute
      'comment on column public.pool_questions.embedding is '
      '''gemini-embedding-001 at 768 dimensions (a published Matryoshka truncation of its '
      'native 3072), L2-normalised on write so cosine distance and inner product agree. '
      'Null until the question has been embedded; the deduplicator treats null as '
      '"fingerprint only" rather than as "no match".''';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- What a generation run spent, in the ledger that already exists
--
-- The spend cap has to be checked *before* the call that would break it, which means
-- summing what the run has spent so far, which means the ledger has to know which run a
-- call belonged to. One nullable column does that. Deliberately not a second ledger: the
-- point of `ai_calls` is that every model call the product makes is in one place, and a
-- generation job with its own cost table would be the first thing to make that false.
--
-- Nulls out rather than cascades, for the reason the existing columns do: deleting a run's
-- bookkeeping must not rewrite what the product actually spent last month.
-- ---------------------------------------------------------------------------

alter table public.ai_calls
  add column pool_run_id uuid references public.pool_generation_runs (id) on delete set null;

-- The sum the cap is checked against, on every call the job makes.
create index ai_calls_pool_run_idx on public.ai_calls (pool_run_id) where pool_run_id is not null;

comment on column public.ai_calls.pool_run_id is
  'The question-pool generation run this call belongs to, or null for everything else. '
  'What the run has spent is sum(micro_usd) over this column -- checked before each call, '
  'because a cap checked after the money is gone is not a cap.';

-- ---------------------------------------------------------------------------
-- Companies
--
-- The owner's 40 for the first pool run: twenty US product employers, ten global, ten
-- Indian. As of 20260914000000_question_bank.sql every one of them is already in
-- `companies` with these exact slugs, so this insert is expected to write nothing. It is
-- here so the pool's company list is stated in the migration that needs it rather than
-- being an invisible dependency on another file's seed -- and so a database that somehow
-- lacks one of them gets it.
--
-- Archetypes are copied exactly from the bank seed, which sets one only where
-- `ArchetypeResolver.KNOWN` already decides it, so the table and the routing code cannot
-- disagree. The rest stay null and a round for them runs on the resolver's inferred
-- archetype, labelled inferred. **Nothing here updates an existing row**: filling in an
-- archetype the bank deliberately left open would be this migration quietly deciding what
-- kind of employer somebody is.
-- ---------------------------------------------------------------------------

insert into public.companies (slug, name, aliases, archetype) values
  -- US
  ('google', 'Google', '{"google llc","google inc"}', 'global_product'),
  ('amazon', 'Amazon', '{"amazon.com"}', 'global_product'),
  ('microsoft', 'Microsoft', '{"microsoft corporation"}', 'global_product'),
  ('meta', 'Meta', '{"facebook","meta platforms"}', 'global_product'),
  ('apple', 'Apple', '{"apple inc"}', 'global_product'),
  ('netflix', 'Netflix', '{}', 'global_product'),
  ('nvidia', 'Nvidia', '{"nvidia corporation"}', null),
  ('salesforce', 'Salesforce', '{}', null),
  ('oracle', 'Oracle', '{"oracle corporation"}', null),
  ('adobe', 'Adobe', '{"adobe inc","adobe systems"}', 'global_product'),
  ('uber', 'Uber', '{"uber technologies"}', 'global_product'),
  ('airbnb', 'Airbnb', '{}', null),
  ('linkedin', 'LinkedIn', '{}', null),
  ('intuit', 'Intuit', '{}', null),
  ('paypal', 'PayPal', '{}', null),
  ('stripe', 'Stripe', '{}', null),
  ('databricks', 'Databricks', '{}', null),
  ('snowflake', 'Snowflake', '{}', null),
  ('pinterest', 'Pinterest', '{}', null),
  ('dropbox', 'Dropbox', '{}', null),
  -- Global
  ('atlassian', 'Atlassian', '{}', 'global_product'),
  ('shopify', 'Shopify', '{}', null),
  ('spotify', 'Spotify', '{}', 'european_employer'),
  ('booking-com', 'Booking.com', '{"booking"}', 'european_employer'),
  ('adyen', 'Adyen', '{}', 'european_employer'),
  ('sap', 'SAP', '{}', 'european_employer'),
  ('zalando', 'Zalando', '{}', 'european_employer'),
  ('cloudflare', 'Cloudflare', '{}', null),
  ('gitlab', 'GitLab', '{}', null),
  ('wise', 'Wise', '{"transferwise"}', null),
  -- India
  ('flipkart', 'Flipkart', '{}', 'indian_product'),
  ('swiggy', 'Swiggy', '{}', 'indian_product'),
  ('zomato', 'Zomato', '{}', 'indian_product'),
  ('razorpay', 'Razorpay', '{}', 'indian_product'),
  ('zerodha', 'Zerodha', '{}', 'indian_product'),
  ('freshworks', 'Freshworks', '{"freshdesk"}', 'indian_product'),
  ('zoho', 'Zoho', '{"zoho corporation","zoho corp"}', 'indian_product'),
  ('cred', 'CRED', '{}', 'indian_product'),
  ('meesho', 'Meesho', '{}', 'indian_product'),
  ('phonepe', 'PhonePe', '{}', null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Row-level security: the same posture as `ai_calls` and the source library
--
-- Enabled with no policies, which denies every client outright, and that is the intent
-- rather than an unfinished job. The pool is never listed to a candidate -- it is not a
-- browsable question bank, it is what a round reaches for when nothing sourced exists, and
-- a candidate who could read it ahead of a round would be reading their own interview. The
-- API connects as the database owner and so is not subject to these policies; the pool is
-- read server-side, by the round.
-- ---------------------------------------------------------------------------

alter table public.pool_questions enable row level security;
alter table public.pool_generation_runs enable row level security;
alter table public.pool_generation_cells enable row level security;

comment on table public.pool_questions is
  'Questions written by a model from its own knowledge, per company x round type x role '
  'family x level. SEPARATE FROM bank_questions ON PURPOSE and must stay that way: a bank '
  'question is something a fetched document says a real employer asked, and its company '
  'tags are derived from those documents. A pool question is corroborated by nobody. There '
  'is no code path from this table into the bank, so a generated question can never '
  'acquire a sourced company tag -- which is a property of the schema rather than of '
  'somebody remembering a where clause. Never listed in the UI; read server-side by a '
  'round when the bank has nothing for that company and round.';

comment on column public.pool_questions.association is
  'company_specific only where the model separately said it knows this employer''s process '
  'and knowledge_basis records what it said. Otherwise employer_kind, and the candidate is '
  'told about the kind of employer, never about the company.';

comment on table public.pool_generation_cells is
  'One unit of generation work per (run, company, round type, role family, level). Written '
  'up front as pending and marked as the job finishes each one, so a job killed halfway '
  'resumes without generating anything twice.';
