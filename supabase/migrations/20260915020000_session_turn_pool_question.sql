-- ---------------------------------------------------------------------------
-- Pool-driven rounds (task 042, PRD §03, §04, §09)
--
-- A turn that asked a question from the AI pool records which one, exactly as
-- `bank_question_id` does for the sourced bank (20260914010000_bank_rounds.sql). Two
-- things read it:
--
-- - Selection, so a candidate is never asked the same pool question twice, in this round
--   or any later one.
-- - Nothing about provenance: a pool question is `model_knowledge`, always, and its label
--   is written into the turn's `provenance` by the engine when the question is asked.
--
-- Additive only. `on delete set null`: a pool question can be deleted by the owner, and
-- that must not take the candidate's transcript with it. The turn keeps the words that
-- were asked and the label recorded at the time.
--
-- The column inherits session_turns' row-level security; no new policy is needed.
-- ---------------------------------------------------------------------------

alter table public.session_turns
  add column pool_question_id uuid references public.pool_questions (id) on delete set null;

create index session_turns_user_pool_question_idx
  on public.session_turns (user_id, pool_question_id)
  where pool_question_id is not null;
