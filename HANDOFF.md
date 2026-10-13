# Handoff — 2026-10-13

## Task
Replace only the browser-tab favicon from the supplied exact-favicon kit; user request, no task file.

## What I built
- Replaced `apps/web/src/app/favicon.ico` with the supplied `favicon-light.ico` and `apps/web/src/app/icon.png` with `favicon-light-192.png`.
- Left site wordmarks, compact logo, and Apple touch icon unchanged. The copied files match the source SHA-256 hashes.

## Assumptions I made
- The light variant matches the light browser-tab screenshot. The dark variant was not added because the request was limited to the shown tab favicon.

## What I could NOT verify
- Browser chrome may cache a previous favicon until its tab is refreshed. Final appearance in the owner's browser remains to be checked there.

## Verification status
- Frontend typecheck, lint, all 3,012 tests, and production build pass.
- Backend `ktlintCheck test build` passes.
- Local browser exposed the updated `.ico` and 192 px PNG icon links, and the PNG route displayed the supplied U. The Apple icon link remained unchanged.
- GitHub CI: pending branch push.

## Merge status
- Branch `fix/exact-browser-favicon` is ready to push. Merge into `develop` only after GitHub CI passes. `main` is release-only and was not touched.

## Suggested next task
- Refresh the browser tab after deployment to clear any cached favicon.

## Open questions for you
- None.
