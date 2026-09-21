-- ---------------------------------------------------------------------------
-- The aptitude round (task 048, PRD §06)
--
-- `round_type` had eight values and none of them was aptitude, which for Indian campus
-- placement is the gate that comes first and eliminates most candidates before any
-- technical round. A fresher product without it is missing the round that decides the
-- most outcomes.
--
-- What this round is *not*: a timed multiple-choice test. It is spoken reasoning about
-- aptitude material — the candidate talks through the set-up, the assumptions and the
-- arithmetic. See `RoundType.APTITUDE` for why that is the defensible reading of a
-- voice-first product, and note that no MCQ engine was built.
--
-- **Nothing about any employer's test is encoded here or anywhere this value is used.**
-- No duration, no section count, no cut-off, no named assessment: every figure in
-- circulation about those traces to prep aggregators rather than to the employer, and a
-- confidently invented claim about a real company's process is the most damaging thing
-- this product can do (CLAUDE.md). The round is described at archetype level and the
-- questions behind it are `model_knowledge`, labelled as such by the engine.
--
-- Additive, and the only change here. The value is appended rather than inserted before
-- an existing one, so no existing row's sort order moves. `if not exists` makes it safe
-- to re-run.
--
-- Postgres allows `alter type ... add value` inside a transaction block from 12 onwards,
-- but the new value cannot be *used* in the same transaction — which is why this
-- migration only adds it and nothing else inserts or casts to `'aptitude'` below.
-- ---------------------------------------------------------------------------

alter type public.round_type add value if not exists 'aptitude';

comment on type public.round_type is
  'The round types this product runs (PRD §06). `aptitude` is the campus reasoning gate, '
  'conducted as spoken reasoning rather than as a timed multiple-choice test.';
