-- Course progress, tied to the account rather than the browser (PRD 05, courses surface).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- Chapter completion shipped first in `localStorage`, which meant progress did not follow
-- a candidate to a second device, to a college lab machine, or to a different browser on
-- the same machine — and, worse on a shared computer, did not go away when they signed
-- out. Both problems are the same problem: the progress was never attached to anybody.
--
-- One row per chapter a candidate says they have finished. Absence is "not finished", so
-- un-ticking is a delete and there is no state to reconcile.
--
-- The slugs are stored as plain text rather than as foreign keys because course content
-- is static TypeScript in the web app (`apps/web/src/content/courses`), not database
-- rows. The reader is therefore the authority on what exists, and a stored slug for a
-- chapter that has since been renamed is ignored when progress is counted rather than
-- being allowed to push a course past 100%. That check lives in `summarizeChapters`.

create table public.course_progress (
  user_id uuid not null references public.users (id) on delete cascade,
  -- Matches `Course.slug` / `Chapter.slug` in the web app's course content.
  course_slug text not null check (length(course_slug) between 1 and 100),
  chapter_slug text not null check (length(chapter_slug) between 1 and 200),
  completed_at timestamptz not null default now(),
  -- One row per chapter per candidate: marking a finished chapter finished again is a
  -- no-op rather than a duplicate, which is what lets the endpoint be idempotent.
  primary key (user_id, course_slug, chapter_slug)
);

comment on table public.course_progress is
  'Chapters a candidate has marked complete. Declared by the candidate, never inferred '
  'from having opened the page.';

-- Every read is "this candidate's progress in this course", which the primary key's
-- leading columns already serve, so no further index is needed.

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Personal data with an owner column, so it gets RLS like every other such table. These
-- policies govern direct client access through Supabase (PostgREST). The API connects as
-- the database owner and enforces ownership itself from the verified JWT subject.
--
-- Delete is included, unlike `sessions`: un-ticking a chapter is the candidate's own
-- correction of their own record, not the removal of an interview result.
-- ---------------------------------------------------------------------------

alter table public.course_progress enable row level security;

create policy course_progress_select_own on public.course_progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy course_progress_insert_own on public.course_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy course_progress_delete_own on public.course_progress
  for delete to authenticated using ((select auth.uid()) = user_id);
