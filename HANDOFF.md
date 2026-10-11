# Handoff — 2026-10-11

## Task
Rename the product to Untiered everywhere and remove every former-brand reference. User request; no task file.

## What I built
- Replaced all user-facing former-brand names and `A` monograms with Untiered and `U` across landing, login, app shell, course, legal, error, metadata, and footer surfaces in `apps/web/src`.
- Renamed the npm workspace and package scope to `untiered` / `@untiered/*` across manifests, lockfile, imports, and Next.js transpilation configuration.
- Renamed Docker image tags, the Spring application name, the source-library bot identity, and the default test-user domain to Untiered equivalents.
- Pointed the source-library bot identification URL at the planned `https://untiered.tech/bot` domain.
- Updated repository documentation, course licence copy, tests, and CI references, and verified that no former-brand text or tracked filenames remain. Extracted PRD PDF text was also checked separately.

## Assumptions I made
- The requested domain is `untiered.tech`, so the former `.com` bot URL becomes `untiered.tech` rather than `untiered.com`.
- Internal `InterviewOS` Kotlin package/configuration names and the historical PRD filename are separate engineering identifiers, not product-brand references, and remain unchanged to avoid a much larger unrelated namespace migration.

## What I could NOT verify
- Final visual brand judgment remains human-owned; this change preserves the existing design and updates only its name and monogram.
- The new domain is not yet connected or deployed, so `https://untiered.tech/bot` could not be checked live.

## Verification status
- Frontend local: typecheck pass; lint pass; 68 test files / 2,988 tests pass; production build pass.
- Backend local: `ktlintCheck test build` pass.
- Rename audit: no old product text in tracked text files, tracked filenames, or extracted PRD PDF text.
- Remote CI: required web, API, and Docker image/build-and-serve jobs passed on the final branch head before merge.

## Merge status
- PR #58 was merged into `develop` only after visible green CI on the final branch head. `main` was not modified.

## Suggested next task
- Connect `untiered.tech` to the deployed web app and add its production DNS/hosting configuration when the domain is acquired.

## Open questions for you
- None.
