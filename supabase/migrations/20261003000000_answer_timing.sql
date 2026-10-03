-- Spoken-English feedback (PRD §09). The report now shows how fast a candidate spoke and
-- how long they paused, and those numbers have to be measured rather than guessed by a
-- model. The browser measures them from the microphone level while the answer is being
-- recorded — when speech was first heard, when it was last heard, and every silence of a
-- second or longer in between — and sends them with the answer. They are kept here, on
-- the turn they describe, so the report reads them the same way it reads the transcript.
--
-- Additive and nullable: every turn answered before this existed has no timing, and the
-- report says so instead of inventing a value. The column lives on `session_turns`, so
-- retention and round deletion (which delete the turn rows) take it with them.

alter table public.session_turns
  add column if not exists answer_timing jsonb;

comment on column public.session_turns.answer_timing is
  'Speech timing measured in the browser from the microphone level while this answer was recorded: recordedMs, firstSoundMs, speakingMs, pauseCount, longestPauseMs, totalPauseMs. Null when not measured.';
