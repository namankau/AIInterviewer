-- Real interviews have a shape and a clock. Ours had neither: it opened cold on a
-- system-design question, ran for an arbitrary eight exchanges, and ended when a counter
-- said so. Nobody has ever sat in an interview that began that way.
--
-- A round now warms up (who you are, what you have built, what you work in), then the
-- interviewer tells you how the next forty minutes will go, then the substantive
-- questions start, and it closes when the clock says so rather than when a counter does.

-- Where a turn sits in the round. The report reads these: a warm-up answer is context,
-- not evidence of competence, and scoring it as though it were would be unfair.
create type public.turn_phase as enum ('warmup', 'main', 'closing');

alter table public.session_turns
  add column phase public.turn_phase not null default 'main';

comment on column public.session_turns.phase is
  'Where this exchange sits in the round. Warm-up answers are context for the report, not scored competencies.';

-- What the interviewer observed about delivery and presence on this turn, from the video
-- when the candidate consented to it and from the audio otherwise.
alter table public.session_turns
  add column delivery_note text;

comment on column public.session_turns.delivery_note is
  'Observed delivery — pace, structure, composure, and body language when video was consented to.';

-- The round is time-boxed like a real one. Stored rather than assumed so a session that
-- spans a restart still knows how long it was meant to be.
alter table public.sessions
  add column duration_minutes integer not null default 40
    check (duration_minutes between 10 and 120);

comment on column public.sessions.duration_minutes is
  'How long the round is scheduled to run. The clock, not a turn counter, ends the interview.';
