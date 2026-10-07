# Handoff — 2026-10-08

## Task
Go-live fixes requested by the owner after the readiness report:
- a privacy policy;
- a daily free limit of 2 rounds and 60 minutes, with an "upgrade to Pro" notice;
- Sentry and logging;
- "fix all things you can fix".

No task file.

## What I built
- **Daily free allowance**, merged and with its migration applied.
  - **Rule:** 2 rounds and 60 planned minutes a day per account, reset at midnight India time (`interviewos.entitlement.daily-rounds`, `daily-minutes`, `day-zone`).
  - **Counted from a new `practice_usage` table** (migration `20261008000000`). It is not a foreign key to `sessions`, so deleting a round does not refund it. It is removed with the account.
  - **Past the limit:** the API answers 402 with a reason code (`daily_rounds_reached`, `daily_minutes_reached`, `daily_minutes_short`).
  - **On screen:** the dashboard and setup page show "Today's free practice is used · Pro · coming soon" instead of a start button. Setup only offers round lengths that fit in the minutes left.
  - Files: `Entitlement.kt`, `EntitlementProperties.kt`, `InterviewService.kt`, `SessionRepository.kt`, `daily-limit-notice.tsx`, `dashboard-panel.tsx`, `new-interview-form.tsx`.
- **Sentry and logs**, merged.
  - **Web:** `@sentry/nextjs` (`instrumentation*.ts`, `lib/sentry-options.ts`). The error pages report what they catch, and the API client reports 5xx responses.
  - **API:** `sentry-spring-boot-4-starter` plus logback. Every ERROR log becomes an event.
  - **Privacy:** no replay, no request bodies, no cookies or auth headers, no default PII. API events are tagged by account ID only.
  - **Off by default:** nothing is sent until a DSN is set.
  - **New log lines:** refused admin access, and what each loop brief stood on, including whether the billed lookup ran.
- **Per-account hourly AI rate limits**, merged (`common/AiRateLimit.kt`). Over a limit the API answers 429 with `Retry-After`:
  - round drafts: 30 an hour;
  - loop brief and prep plan together: 40;
  - resume uploads: 6;
  - hints: 40.
- **Deployment images**, merged.
  - **API:** `apps/api/Dockerfile`, built with the JDK and run on a JRE, as a non-root user.
  - **Web:** `apps/web/Dockerfile`, a standalone Next.js server run as a non-root user. Standalone output is only switched on inside the image.
  - A new CI job, `images`, builds both and checks that the web image serves a page.
- **Legal pages**, PR #39, not merged.
  - Public `/privacy`, `/terms` and `/contact`, written from what the code does.
  - Linked from the landing-page footer, the login page and the recording-consent box.
- **Other fixes:**
  - CLAUDE.md and AGENTS.md no longer mention `RECORD_CAMERA`, which no longer exists.
  - Merged Dependabot PRs #26–#29 (GitHub Actions versions).
  - Asked Dependabot to rebase #30.

## Assumptions I made
- **"Consume only 60 mins"** means planned minutes: the length chosen at setup counts in full when the round starts. A round that ends early still uses its full length. That's the safer side for cost, and the clock is what ends a round.
- **"Max 2 rounds"** counts rounds started, not finished. The model is paid for from the first question.
- **"Upgrade to Pro":** no paid tier exists, so the notice says Pro is coming soon. A checkout that doesn't work would be a false claim.
- **The day resets at midnight India time** for everyone, because the product is India-first.
- **Rate limits are kept in memory** on each API instance. That's exact with one instance and still a bound with several.
- **`npm audit fix` was tried and reverted.** It only fixed one issue and pulled native binaries into the drawing component's build chain. The remaining issues need the drawing component moved to an older major version, which can wait until after launch.

## What I could NOT verify
- **Live use:** no live round was run (rule 7), so there's no live test of the limits or of Sentry delivering events. Set the DSNs, then trigger an error to confirm.
- **The legal text** needs your review, and ideally a lawyer's. In particular:
  - the age clause (courses are written for class 12; under-18s need verifiable parental consent);
  - the Gemini key must be on a billing-enabled project, or the "not used for training" line is false.
- **Supabase's security checks:** the Supabase connector is signed in to an account without access to this project.

## Verification status
- Web: typecheck, lint and tests pass (62 files, 2,962 tests); the build passes.
- API: `ktlintCheck test build` passes, including `DailyAllowanceTest`, `AiRateLimiterTest` and `RoundDraftRateLimitTest`.
- CI on `develop` at `bdb41fc`: all three jobs pass (web, api, images). The PR branches pass against current `develop`: #37 at `c9c1fb0`, #39 at `f394bc0`.

## Merge status
- **Merged into `develop`:** the daily limit (`d7807a7`), Sentry (`5d8f699`), hardening (`bdb41fc`), and Dependabot #26–#29.
- **Migration `20261008000000` is applied** to the linked project.
- **PRs waiting for you:**
  - #37 (account deletion; its migration is already applied);
  - #39 (legal pages);
  - #38 (`develop` → `main`).

  Both #37 and #39 were updated with `develop` today and pass CI.
- **Not merged:**
  - #36: Kotlin 2.4 breaks the ktlint plugin. Leave it until after launch.
  - #30: conflicts; asked Dependabot to rebase.
  - #31–#35: major-version upgrades. After launch.

## Suggested next task
- Choose hosting and a domain, set the production environment variables (`.env.example` lists them all), and deploy the two images.

## Open questions for you
- Your contact email, the operator name and a grievance officer for the legal pages (environment variables listed in PR #39).
- Can under-18 students use the product? That decides whether parental consent has to be built.
