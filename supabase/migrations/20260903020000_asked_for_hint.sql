-- The candidate may ask for help, and it goes on the record (PRD 06, 09).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- `intervention` already records what the interviewer chose to supply in response to an
-- answer. This is a different event: help the candidate asked for, before answering.
-- Conflating the two would let a requested hint be overwritten by the assessment of the
-- answer it shaped, and the report would under-report how much was needed.
--
-- A stuck candidate previously had no move but silence, which is neither realistic nor
-- useful: a real interviewer nudges. Making it askable is only fair if it is also
-- counted, so it is stored per turn and weighed in the assistance summary.

alter table public.session_turns
  add column hint_requested_at timestamptz,
  add column hint_text text,
  -- How much the hint gave away, on the same scale as help the interviewer volunteered,
  -- so the assistance summary can discount the turn by what was actually supplied.
  add column hint_level public.intervention_type,
  -- Text without a timestamp would be a hint nobody can date; a timestamp without text
  -- would be a hint nobody can read. Neither is worth carrying into a report.
  add constraint session_turns_hint_consistency check (
    (hint_requested_at is null and hint_text is null and hint_level is null)
    or (hint_requested_at is not null and hint_text is not null and hint_level is not null)
  );

comment on column public.session_turns.hint_requested_at is
  'When the candidate asked for help on this question. Counted against them in the report.';
