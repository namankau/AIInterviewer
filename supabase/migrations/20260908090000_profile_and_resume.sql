-- Profile details and the resume that grounds an interview (PRD 05).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- The tables for all of this have existed since task 001 and have been empty of
-- behaviour ever since, which is why the project deep-dive round has been generic. This
-- adds the three columns that were missing and nothing else: the resume itself, the
-- skills and the employment history already have somewhere to live.
--
-- Note what is still absent: any target employer list. Company and role are named per
-- session (CLAUDE.md), and a LinkedIn URL is a fact about the candidate, not a target.

alter table public.profiles
  -- Optional, and shown to nobody but the candidate. It exists because a resume often
  -- omits what a profile makes obvious, and an interviewer that has read both asks
  -- better questions than one that has read either.
  add column linkedin_url text,
  -- One line the candidate can correct. Parsed from the resume when there is one,
  -- because a headline somebody wrote about themselves is better than a title.
  add column headline text,
  -- Storage object, in the resumes bucket, keyed under `{userId}/`. Not a URL: a signed
  -- one expires, and storing the path means it can be re-signed.
  add column avatar_path text;

comment on column public.profiles.linkedin_url is
  'Optional. Not fetched or scraped -- it is context the candidate volunteered.';

-- The resume an interview is grounded in is the most recently parsed one. Derived
-- rather than flagged, so uploading a new resume cannot leave two marked current.
create index resumes_user_parsed_idx
  on public.resumes (user_id, parsed_at desc)
  where parse_status = 'parsed';
