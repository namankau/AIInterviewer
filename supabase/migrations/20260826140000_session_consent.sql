-- Recording consent, and how confidently the company was resolved.
--
-- CLAUDE.md makes consent a hard gate: explicit, separately covering audio and video,
-- stored with a timestamp, captured before any capture starts. Nullable columns rather
-- than a boolean so the record is *when* consent was given, which is what a data
-- request actually needs. A session may not begin capture with either column null.
--
-- archetype_confidence records whether the named employer was recognised or whether the
-- archetype was inferred. The UI must say so — presenting an archetype-level pattern as
-- a specific claim about a real company is the worst failure this product has (PRD 04).

alter table public.sessions
  add column consent_audio_at timestamptz,
  add column consent_video_at timestamptz,
  add column archetype_confidence text
    check (archetype_confidence in ('recognised', 'inferred'));

comment on column public.sessions.consent_audio_at is
  'When the candidate consented to audio recording. Null means no consent — do not capture.';
comment on column public.sessions.consent_video_at is
  'When the candidate consented to video recording. Null means no consent — do not capture.';
comment on column public.sessions.archetype_confidence is
  'recognised = this employer is known; inferred = archetype fallback, and the UI must say so.';
