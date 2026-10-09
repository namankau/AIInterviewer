# Handoff — 2026-10-09

## Task
Explain Dependabot PRs #46–#48, fix and merge the updates that are appropriate, and keep incompatible upgrades out of the supported toolchain. User request; no task file.

## What I built
- Landed the safe `@vitejs/plugin-react` 6.1.1 → 6.1.2 patch in `apps/web/package.json` and `package-lock.json`; this supersedes Dependabot PR #46.
- Added explicit major-version guardrails in `.github/dependabot.yml` so `@types/node` continues to describe the repository's declared Node 20 minimum and ESLint stays on v9 until the complete Next/React lint-plugin chain supports v10.
- Closed Dependabot PRs #46–#48 with audit comments: #46 was superseded by the verified patch, #47 proposed an inappropriate Node 26 type-surface jump and failed its Docker build, and #48 failed because the current React ESLint plugin is incompatible with ESLint 10.

## Assumptions I made
- Node type definitions should match the oldest supported runtime declared by the repository, not whichever Node major is newest on npm.
- ESLint is a coordinated toolchain migration; a major is not mergeable until Next's entire plugin chain runs cleanly with it.
- A patch dependency update that passes the complete web/API/Docker matrix is appropriate to merge without separate product review.

## What I could NOT verify
- The local Windows host's Node 24 Turbopack worker exited before connecting during `next build`. Both exact-tree Node 22 CI builds and Docker image builds passed, so this is recorded as a host-runtime limitation rather than hidden.
- `npm ci` reports 19 existing transitive advisories. I did not run `npm audit fix --force` because it can introduce unrelated breaking upgrades; security-advisory triage should be a separate scoped task.

## Verification status
- Frontend typecheck / lint / typography policy / tests: pass; 68 files and 2,984 Vitest tests.
- Backend ktlint / tests / build: pass.
- Exact feature-head CI: pass at `5e5e913` ([run 37930076657](https://github.com/namankau/AIInterviewer/actions/runs/37930076657)); web, API, and Docker image jobs are green.
- Post-merge `develop` CI: pass at the same commit ([run 37930419595](https://github.com/namankau/AIInterviewer/actions/runs/37930419595)); web, API, and Docker image jobs are green.

## Merge status
- Branch `fix/dependency-update-policy` was fast-forwarded into `develop` at `5e5e913` after exact-head CI passed.
- Dependabot PRs #46, #47, and #48 are closed with reasons recorded in their conversations.
- Release PR [#50](https://github.com/namankau/AIInterviewer/pull/50) is open from `develop` to `main`; `main` was not pushed or modified directly.
- This final documentation handoff is being CI-gated on `docs/dependency-maintenance-handoff` before it is fast-forwarded into `develop`.

## Suggested next task
- Review and merge PR #50, then triage the npm audit report without using blanket forced upgrades.

## Open questions for you
- None.
