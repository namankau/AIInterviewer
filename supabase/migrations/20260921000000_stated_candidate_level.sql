-- ---------------------------------------------------------------------------
-- Let a candidate say they are a student or fresher (task 051, follows task 048)
--
-- Task 048 derives "campus fresher" from the role title and the resume, and that
-- derivation is a good default — but it leaves a hole for exactly the candidate this
-- work is for: someone who types a plain "Software Engineer" with no resume behind it
-- still gets a mid-level round, and a final-year student practising for campus
-- placements is the most likely person to do precisely that.
--
-- `sessions.stated_level` is what the candidate said about their own stage when the
-- round started: `student`, `recent_graduate` or `professional`, or null when they said
-- nothing. It has to be stored with the session, not re-typed later, because the report
-- (`ReportService`) has to score against the same bar the round was actually conducted
-- at — and a candidate's resume, or the role title on a since-edited session, is free to
-- change after the round without changing what they were asked at the time.
--
-- Nullable and additive, so every existing row and every session started without this
-- column deployed reads as null — which reproduces the pre-051 derivation exactly
-- (`CandidateStage.of`). The check constraint mirrors the enum in `DeclaredStage.kt`;
-- an application-level 400 rejects an unrecognised value before it ever reaches here,
-- so this constraint is a backstop against a value written some other way, not the
-- primary defence.
--
-- **This migration must be applied at merge (`npm run db:push`), not as a follow-up.**
-- CI does not run migrations, and `ReportService` and `InterviewService` now select
-- `stated_level` on every session read — an unapplied migration here would break every
-- session read the moment this branch's code reaches `develop`, the same failure mode
-- CLAUDE.md rule 1 names for `report_expired_at`.
-- ---------------------------------------------------------------------------

alter table public.sessions
  add column if not exists stated_level text
    check (stated_level is null or stated_level in ('student', 'recent_graduate', 'professional'));

comment on column public.sessions.stated_level is
  'What the candidate said about their own stage when the round started (task 051): '
  '''student'', ''recent_graduate'' or ''professional''. Null means they said nothing, '
  'and the stage is derived from the role title and resume alone (CandidateStage.of).';
