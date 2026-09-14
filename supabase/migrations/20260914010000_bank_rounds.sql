-- ---------------------------------------------------------------------------
-- Bank-driven rounds (task 038, PRD §06, §08)
--
-- A turn that asked a question from the bank records which one. Two things read it:
--
-- - Selection, so a candidate is not asked the same reported question twice. When every
--   question for a company and round has been asked, the least recently asked come back.
-- - Provenance, which is decided per turn by the engine: a turn with a bank question is
--   `published_source` with that question's citations; every other turn is
--   `model_knowledge`.
--
-- Additive only. `on delete set null`: a bank question disappears when its last source is
-- deleted, and that must not take the candidate's transcript with it. The turn keeps the
-- words that were asked and the provenance recorded at the time.
--
-- The column inherits session_turns' row-level security; no new policy is needed.
-- ---------------------------------------------------------------------------

alter table public.session_turns
  add column bank_question_id uuid references public.bank_questions (id) on delete set null;

create index session_turns_user_bank_question_idx
  on public.session_turns (user_id, bank_question_id)
  where bank_question_id is not null;
