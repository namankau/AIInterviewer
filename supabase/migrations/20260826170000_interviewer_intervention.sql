-- A real interviewer helps you. They cut in when you ramble, they give you a nudge when
-- you are circling the answer, and they hand you the thing you cannot recall so the
-- conversation can move. An interviewer who silently lets you drown is not realistic —
-- and it wastes the round for everyone.
--
-- But help received is signal. A candidate who reached the right answer after two hints
-- did not perform the same as one who got there unaided, and the report has to say so
-- rather than quietly averaging the difference away. So each turn records what help was
-- given, and the report reads those back.

-- New actions the interviewer can take mid-round. ADD VALUE cannot be used in the same
-- transaction that creates it, which is fine — nothing writes these until runtime.
alter type public.turn_next_action add value if not exists 'redirect';
alter type public.turn_next_action add value if not exists 'hint';
alter type public.turn_next_action add value if not exists 'guide';

-- What the interviewer actually had to supply on this turn.
--   none       answered under their own steam
--   redirected rambling or drifting; cut in and refocused
--   hinted     circling the answer; nudged toward it
--   guided     stuck or could not recall; led step by step
--   corrected  materially wrong; told them and moved on
create type public.intervention_type as enum ('none', 'redirected', 'hinted', 'guided', 'corrected');

alter table public.session_turns
  add column intervention public.intervention_type not null default 'none',
  add column intervention_note text;

comment on column public.session_turns.intervention is
  'What help the interviewer gave on this turn. Feeds the assisted-performance read in the report.';
comment on column public.session_turns.intervention_note is
  'What was actually supplied, in the interviewer''s words, so the report can quote it back.';

-- Reports are grouped and compared by assistance, so the column is worth an index.
create index session_turns_intervention_idx
  on public.session_turns (session_id, intervention)
  where intervention <> 'none';
