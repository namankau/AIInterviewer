-- Speech comes off the critical path (PRD 06).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- Generating the interviewer's voice used to happen inline, between the candidate
-- finishing an answer and the next question reaching them — about half of the measured
-- 24-second turn. The question text is now returned as soon as it exists and the audio
-- follows, so the room needs to tell three states apart: still rendering, ready, and
-- never coming. A null path alone cannot say which.

create type public.speech_status as enum ('pending', 'ready', 'unavailable');

alter table public.session_turns
  add column question_audio_status public.speech_status not null default 'pending';

-- Existing rows were spoken inline, so their state is already settled: a stored object
-- means it played, and a null path means synthesis failed and the turn ran as text.
update public.session_turns
   set question_audio_status = case
         when question_audio_path is not null then 'ready'::public.speech_status
         else 'unavailable'::public.speech_status
       end;

comment on column public.session_turns.question_audio_status is
  'Whether the spoken question is still rendering, ready to play, or unavailable. '
  'Speech is a nicety: `unavailable` degrades the turn to text, it never fails the round.';
