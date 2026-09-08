-- The curated source library (PRD 03, 04, 09).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- What this is: somewhere the owner puts specific documents and links about how named
-- employers actually interview, which the API re-reads on a schedule so the corpus stays
-- current. Questions extracted from those sources carry the source with them, so the
-- report can tell a candidate where a question came from and link to it.
--
-- What this is NOT, deliberately: a crawler. `CLAUDE.md` puts bulk scraping of LeetCode,
-- Blind, Reddit, Glassdoor, AmbitionBox and GeeksforGeeks out of scope by decision. Only
-- URLs somebody explicitly added are ever fetched, robots.txt is honoured on each one,
-- and links are never followed off the page. Curating a reading list is not crawling the
-- web, and the difference is enforced in SourceFetcher rather than left to good manners.

create type public.source_kind as enum ('link', 'document');

create type public.source_status as enum (
  'pending',        -- added, not yet read
  'fetched',        -- read, and questions extracted
  'failed',         -- could not be read; fetch_error says why
  'blocked'         -- robots.txt disallows it, and that is final
);

-- ---------------------------------------------------------------------------
-- interview_sources — the reading list
-- ---------------------------------------------------------------------------

create table public.interview_sources (
  id uuid primary key default gen_random_uuid(),
  added_by uuid not null references public.users (id) on delete cascade,
  kind public.source_kind not null,

  -- Exactly one of these, depending on kind.
  url text,
  storage_bucket text,
  storage_path text,

  -- What the candidate is shown when a question cites this.
  title text,
  publisher text,
  published_on date,

  -- Which employer this is about. Null means it is general interview material rather
  -- than a report about a named company.
  company_name text,

  status public.source_status not null default 'pending',
  last_fetched_at timestamptz,
  fetch_error text,
  -- Skips re-extraction when a page has not actually changed since the last read.
  content_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint interview_sources_link_has_url
    check (kind <> 'link' or url is not null),
  constraint interview_sources_document_has_object
    check (kind <> 'document' or (storage_bucket is not null and storage_path is not null)),
  constraint interview_sources_url_unique unique (url)
);

create index interview_sources_due_idx
  on public.interview_sources (status, last_fetched_at nulls first);

create index interview_sources_company_idx
  on public.interview_sources (lower(company_name));

create trigger interview_sources_set_updated_at
before update on public.interview_sources
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- source_questions — what was extracted, and what it came from
--
-- `source_id` is not nullable and cascades. A question with no source is exactly the
-- fabricated specificity this table exists to replace, so the schema makes it
-- unrepresentable rather than trusting the writer.
-- ---------------------------------------------------------------------------

create table public.source_questions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.interview_sources (id) on delete cascade,

  company_name text,
  role_family text,
  round_type public.round_type,
  seniority text,

  question_text text not null check (length(btrim(question_text)) > 0),
  -- Context the source gave: what it was testing, what a good answer covered.
  notes text,
  -- When the source says it was asked. Recency is shown to the candidate, so a source
  -- that does not say gets a null rather than a guess.
  asked_on date,

  created_at timestamptz not null default now()
);

create index source_questions_lookup_idx
  on public.source_questions (lower(company_name), round_type);

create index source_questions_source_idx on public.source_questions (source_id);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- The library is operator data, not candidate data. No client-side policy grants access
-- to either table: the API reads them as the database owner, and reaches them only
-- through the admin endpoints, which check the caller against a configured allow-list.
-- ---------------------------------------------------------------------------

alter table public.interview_sources enable row level security;
alter table public.source_questions enable row level security;

comment on table public.interview_sources is
  'Curated reading list of documents and links about how named employers interview. '
  'Only URLs somebody explicitly added are fetched, and robots.txt is honoured. This is '
  'not a crawler and must not become one -- see CLAUDE.md.';
