-- Where each question came from (PRD 03, 04, 09).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- The report tells the candidate why they were asked what they were asked, and on what
-- basis. That only works if provenance is captured when the question is composed --
-- reconstructing it afterwards would mean asking a model to recall its own reasoning,
-- which is how invented citations get made.
--
-- `tier` deliberately mirrors the PRD's taxonomy: model_knowledge, published_source,
-- community_reported. Only the first is reachable today, because there is no retrieval
-- corpus behind this yet, and the tier is set by the engine rather than the model so it
-- cannot claim a source it does not have.

create type public.provenance_tier as enum (
  'model_knowledge',
  'published_source',
  'community_reported'
);

alter table public.session_turns
  add column provenance jsonb;

comment on column public.session_turns.provenance is
  'Why this question was asked and on what basis: {tier, basis, probes, askedBecause, '
  'sources[]}. Written when the question is composed. `sources` is empty until there is a '
  'retrieval corpus -- an invented citation is worse than no citation.';
