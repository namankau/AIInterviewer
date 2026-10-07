# Handoff — 2026-10-07

## Task
Finish the 7 October UI run that Codex left partway through when it hit its usage limit (progress file `runs/2026-10-07-progress.md`; owner request, no task file): selected-round setup, Arena polish, dashboard history limit, sidebar account actions with a simpler profile, and account deletion end to end.

## What I built
- **Selected-round setup** (`new-interview-form.tsx`, `interview/new/page.tsx`, `rounds/page.tsx`): a card on `/rounds` opens setup with that round fixed. The round picker becomes a summary card with a "Change round" link. Company and role are still required. The topic field only appears for `custom_topic`.
  - This replaces Codex's unfinished version, which sent a made-up company called "General practice" and required a topic for every round.
  - That version was wrong for two reasons. The server throws the topic away for any round except `custom_topic` (`InterviewService.kt:234`). And a fake employer would have shown up in readiness and history.
- **Arena** (`challenge-card.tsx`, `arena-session.tsx`, `arena-daily-quest.tsx`, `arena/page.tsx`, `arena/[course]/page.tsx`, `lib/arena/corpus.ts`):
  - **Keyboard bug fixed.** Enter and the 1–4 keys no longer take over a focused link or a control outside the challenge card. Before this, pressing Enter on "Revisit this chapter" or "Choose another set" moved to the next question instead.
  - **Revise list shows chapter titles,** not slugs like `dsa/two-pointers`. Challenges now carry an optional `chapterTitle`, added on the server in `corpus.ts`.
  - **Copy and labels:** course names and counts in the hero come from the course list, and "Campaigns" is renamed to modules.
  - **Chapter chips** that have questions now start a run for that chapter only, and the panel restarts when the chapter changes. Before, they linked to the reading page.
  - **Focus rings** on every Arena control.
- **Dashboard** (`dashboard-panel.tsx`, new `app/history/page.tsx`): shows the 3 newest rounds, with a "See all N rounds" link to `/history`. That page has the same report links and the same delete. `/history` is added to the sign-in-protected routes (`lib/supabase/session.ts`).
- **Account deletion** (branch `feat/account-deletion`):
  - **Endpoint:** `DELETE /api/v1/me` (`account/AccountDeletion.kt`, `AccountRepository.kt`, `AuthAdmin.kt`, `MeController.kt`).
  - **Step 1, one transaction:** it queues deletion of everything stored under the user's folder in both buckets (recordings, resumes, profile photo), using the existing `storage_deletion_jobs` queue. It then deletes the `public.users` row, which removes every user table with it.
  - **Step 2:** the Supabase auth user is deleted through the admin API.
  - **Failure handling:** if the server has no admin key, it refuses before touching anything. If step 2 fails, the response says the data is already deleted, and a retry is safe.
- **Migration** `20261007000000_account_deletion_outbox.sql`: deletion jobs can now be for a whole account. These have no session and the reason `account_deleted`. A job for a single round must still name its round.
- **Storage fix** (`SupabaseObjectStorage.deleteByPrefix`): it now goes into subfolders and pages past 1,000 files. The old version listed only one folder level. So deleting by a user's folder would have removed nothing in the recordings bucket, because each session is its own subfolder.
- **Profile and sidebar** (`profile/page.tsx`, `account-summary.tsx`, `delete-account-section.tsx`):
  - **Profile page:** the navy banner becomes a plain header, and a single Account section holds sign-out and deletion.
  - **Delete confirmation:** before the button works, the section lists everything that will be deleted and asks the user to type "delete".
  - **Sidebar:** the account block at the foot is now a menu that starts closed, with Profile, All rounds, Sign out and Delete account.
  - **Bug fixed:** the profile's "Open interview history" link went to `/rounds`, which is the round catalogue. It now goes to `/history`.

## Assumptions I made
- **"Streamlined setup"** means skipping the round picker and the company brief. It does not mean dropping company and role: the server requires both, and every session is scoped to one employer.
- **"Simplify the profile":** I kept the course progress and latest-interview panels. An existing test pins them in place on purpose (`profile-panel.test.tsx`), so removing them is your call, not mine. I simplified the header and the account area instead.
- **Sign-out back in the sidebar:** a test said sign-out was deliberately moved out of the sidebar. I brought it back because the 7 October request asks for account actions there. It sits behind a menu that starts closed, so the original worry (clicking it by accident) still holds. I updated the test comment to say so.
- **Deletion order:** data first, sign-in second. The other order risks a deleted sign-in with data behind it that nobody can reach any more, and so nobody can ask to delete.

## What I could NOT verify
- **Live account deletion has not been run.** It needs a Supabase service-role key, it is destructive, and per rule 7 I did not test against the real project. Specifically unverified:
  - the admin API `DELETE /auth/v1/admin/users/{id}` (the code treats a 404 as already deleted);
  - that Supabase's storage list reports a folder with `id: null`. This is what the recursive delete relies on, and it is what Supabase's API documents.

  Check both once on a throwaway account.
- **Visual check:** the new setup summary card, the sidebar menu (desktop rail and mobile), the profile layout, and the Arena chips, in a signed-in browser.
- **Existing data issue (not changed):** `interview_sources.added_by` cascades on delete. If an admin deletes their own account, every shared source they added is deleted with it. That needs your decision.

## Verification status
- Web: typecheck, lint and build pass. All 63 test files pass (2,963 tests); the build generated 175 pages.
  - Local typecheck first failed on stale generated route types for the new `/history` page. Running `next typegen` fixed it. CI does not use those generated files.
- API: `./gradlew ktlintCheck test build` passes, including the new `AccountDeletionTest`, `MeControllerDeleteTest` and `SupabaseObjectStorageDeleteTest`.
- GitHub CI: passed on every UI-branch commit, the last being `714ef85` (run 37580143804). CI for `feat/account-deletion` runs on PR #37.

## Merge status
- `fix/ui-flow-and-arena` (setup flow, Arena, dashboard and `/history`; no migration): CI green on `714ef85` (run 37580143804, both jobs), merged into `develop` at `28c4b3f`.
- `feat/account-deletion` (`8fd98b2`, on top of the UI branch): **PR #37 opened, not merged**, because it touches data deletion and auth.
  - Its migration `20261007000000` **is applied** to the linked project (moeronogmgtmbdnzfzgu) on 7 Oct at the owner's request, ahead of the merge. It is backward compatible: round deletion on `develop` keeps working.

## Suggested next task
- Run a live check of account deletion on a throwaway account, then merge the PR and apply the migration.

## Open questions for you
- Should an admin's account deletion keep the shared sources they added (`interview_sources.added_by` → set null instead of cascade)?
