# Handoff — 2026-10-02 (production-readiness quick wins)

## Start here (for the next agent, Codex or Claude)
Where the repository stands at the end of this run:

- **`main` and `develop` have the same content**, apart from this run's branch.
  - The owner merged release PR #23 (`develop` → `main`) on 2 Oct.
  - `origin/main` also carries that PR's merge commit (`7f1c659`), which `develop` does
    not have. That is expected; nothing needs syncing.
- **Open PR: `fix/prod-readiness-quick-wins` → `develop`.** It is left open for human
  review because it changes admin permissions (`AdminAccess`). Do not merge it yourself.
- **Production-readiness review:** a doc titled "AIInterviewer — Production Readiness
  Red Flags" (owner's Claude artifacts). It lists 7 launch blockers (B1–B7) and a phased
  remediation plan. This run fixed what needed no owner decision; the rest is listed
  under "Suggested next task".
- **No migrations are pending.** This run made no schema change.
- **Untracked on purpose:** `.codex/` and `AGENTS.md`. They exist only on the owner's
  machine.
- **Start any new work from `origin/develop`:**
  `git fetch origin && git checkout -b <branch> origin/develop`.
- **The latest task file is task 065, and it is complete.** This run had no task file.
  The next task is 066.

## Task
Fix the production-readiness red flags that can be fixed straight away (owner request,
2 Oct). No task file.

## What I built
- **B1, critical Next.js RCE:** `next` and `eslint-config-next` 16.3.2 → 16.3.8, plus
  `npm audit fix`. `npm audit --omit=dev` went from 12 issues (1 critical, 3 high) to 9
  (2 high, 7 moderate). The remaining two are listed under "Assumptions I made".
- **Security headers** (`apps/web/next.config.ts`), sent on every response:
  - `frame-ancestors 'none'` and `X-Frame-Options: DENY`
  - `Permissions-Policy: microphone=(self), camera=(self)`, with other device access off
  - HSTS, `nosniff`, and `strict-origin-when-cross-origin`
- **Admin access** (`sources/AdminAccess.kt`, `user/SupabaseIdentity.kt`):
  - An email on the allow-list is no longer enough on its own.
  - The account must also have signed in through Google (read from `app_metadata`, which
    users cannot write; `user_metadata.email_verified` is not trusted).
  - Alternatively, admins can be pinned by Supabase user ID with the new
    `ADMIN_USER_IDS` (added to `.env.example`).
- **SSRF block** (`sources/PublicAddress.kt`):
  - Source links must resolve only to public addresses. Loopback, private, link-local,
    cloud-metadata (`169.254.169.254`), carrier-grade NAT, IPv6 private and IPv4-mapped
    addresses are refused.
  - It is checked when a link is added (400 `non_public_address`) and again before every
    fetch.
- **Uploads:**
  - A resume's declared type must match its first bytes (`resume/ResumeSignature.kt`,
    400 `resume_type_mismatch`).
  - User-supplied file names are reduced to safe characters before going into a storage
    key (`storage/StorageKeys.kt`). Before this, a name containing `../` reached the key
    under the user's prefix.
- **Arena API:** `/api/arena/challenges/[course]` now returns 401 without a verified
  session, in line with the owner's sign-in decision of 21 Sep.
- **Error pages:** added `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` and
  `app/interview/[id]/error.tsx`, built on `components/errors/error-panel.tsx`. A render
  failure no longer drops a candidate on Next's bare page.
- **Dependabot** (`.github/dependabot.yml`): weekly npm and Gradle update PRs and
  monthly Actions update PRs, all against `develop`.
- **Tests:** `AdminAccessTest`, `PublicAddressTest`, `ResumeSignatureTest`,
  `StorageKeysTest`, a new SSRF case in `SourceControllerAddLinkTest`, the arena
  `route.test.ts`, and `error-panel.test.tsx`.

## Assumptions I made
- **Admins sign in with Google.** CLAUDE.md names Google OAuth as the sign-in method. If
  the owner signs in another way, they need to set `ADMIN_USER_IDS`, or admin pages will
  return 404.
- **No full script CSP.** Pyodide, Supabase, signed storage URLs and blob audio each need
  allowances that should be proven in a browser first. Only directives that cannot break a
  page were added.
- **Two high advisories are left.**
  - `lodash-es` (via Mermaid in Excalidraw) and `nanoid` 4.x (via
    `mermaid-to-excalidraw`) have no fix inside their pinned majors.
  - npm overrides for them corrupted the install: `lodash-es` vanished from the tree, so
    they were reverted.
  - Both are reachable only through first-party course content.
- **Empty `design-preview/` and `dev-course-preview/` folders were deleted locally.** Git
  never tracked them, so there is no diff.

## What I could NOT verify
- **Headers in a real browser:** whether HSTS, Permissions-Policy or frame-ancestors
  affect the Supabase OAuth redirect, the camera or microphone prompt, or Pyodide. A
  manual pass through sign-in → interview room → report is needed before production.
- **The SSRF check is open to DNS rebinding.** DNS can change between the check and the
  connection; closing that needs a resolver pinned into the HTTP client. Redirects are not
  followed, so they are not a bypass.
- **How the error pages look.**

## Verification status
- Backend `ktlintCheck test build`: pass. New tests: AdminAccess 7, PublicAddress 5,
  ResumeSignature 3, StorageKeys 4, SourceControllerAddLink 5.
- Web typecheck, lint, tests (59 files / 2,925 tests) and build (174 pages): pass.
- CI on the pushed branch: see the PR.

## Merge status
- Branch `fix/prod-readiness-quick-wins` is pushed, with a PR into `develop` left open for
  review, because it changes admin permissions.

## Suggested next task
The readiness blockers still open need the owner, or several days of work:
- B2: account deletion
- B3: per-user rate and spend limits
- B4: privacy policy and terms
- B5: deploy pipeline and monitoring
- B6: database tests in CI
- B7: the grounding terms

Account deletion (B2) is the most self-contained, because the schema already cascades.

## Open questions for you
- Do you sign in as admin with Google? If not, set `ADMIN_USER_IDS` before merging.
