-- The workspace a round is conducted in.
--
-- Two rounds need more on screen than a question and a microphone. A DSA round needs the
-- problem, its examples, its constraints and somewhere to type; a system design round
-- needs the case, its scale numbers and somewhere to draw. Both are composed once, when
-- the session starts, and then never change — the candidate is not handed a different
-- problem halfway through.
--
-- Stored on the session rather than derived per turn for the reason PRD 06 gives about
-- turns: nothing about a session may be lost to a refresh. A problem regenerated on
-- reload would be a different problem, which is worse than losing it.
--
-- `workspace` is the composed material. `board` is what the candidate produced on it —
-- the design they drew, or the code they wrote. They are separate because one is ours and
-- fixed, and the other is theirs and changes constantly.

alter table public.sessions
  add column workspace jsonb,
  add column board jsonb;

comment on column public.sessions.workspace is
  'The problem or case this round is conducted around, composed once at start. Null for '
  'rounds that need no workspace — a behavioural round is a conversation, nothing more.';

comment on column public.sessions.board is
  'What the candidate produced: the design they drew, or the code they wrote. Theirs, '
  'and personal data — it expires and is deleted with the rest of the round.';
