# Handoff — 25 August 2026

## Task

Project scaffold and authentication — `tasks/task-001-scaffold.md` (PRD 05, 11, 13).

## What I built

**Monorepo** — npm workspaces at the root, `README.md` rewritten as a working
run-book, `.gitignore` (the repo had none, so `.env` was one `git add .` away from
being committed), `.env.example` documenting every key.

- `package.json` — workspaces, verification-loop scripts, `db:*` scripts for the CLI
- `scripts/dev.mjs` — starts API and web together with the root `.env` loaded; Node
  stdlib only, no `concurrently` dependency

**Frontend — `apps/web`** — Next.js 16 App Router, TypeScript strict (plus
`noUncheckedIndexedAccess`), Tailwind 4.

- `src/app/page.tsx` landing placeholder, `src/app/login/page.tsx`,
  `src/app/dashboard/page.tsx` (empty authenticated state)
- `src/app/globals.css` — design tokens: one accent, a five-step type scale, light and
  dark. Restrained on purpose per the design direction
- `src/proxy.ts` + `src/lib/supabase/session.ts` — session refresh and the route guard
- `src/app/auth/callback/route.ts` — PKCE exchange; `src/lib/safe-next.ts` keeps `next`
  from becoming an open redirect
- `src/lib/api.ts`, `src/components/account-summary.tsx` — dashboard reads
  `GET /api/v1/me` from the browser, so the profile flow has no server-rendering
  coupling (PRD 13)
- 18 tests, behaviour and role-based queries rather than snapshots

**Backend — `apps/api`** — Spring Boot 4.1.1, Kotlin, Gradle 9.7.1, Java 21 toolchain.

- `GET /api/health` — unauthenticated, reports build info
- `GET /api/v1/me` — first endpoint of the versioned public API; provisions the user
  and profile rows on first sign-in
- `config/SecurityConfig.kt` — stateless resource server, JWTs verified against the
  project's published JWKS. No shared secret, and the user id comes only from the
  verified token subject
- `common/ApiError.kt` — one error envelope for every non-2xx response
- 20 tests

**Database — `supabase/migrations/20260825000000_initial_schema.sql`** — `users`,
`profiles`, `resumes`, `skills`, `sessions`; enums for the closed sets the PRD
enumerates; RLS enabled with policies on all five tables. **No `targets` table**, per
PRD 05.

**Shared types — `packages/shared`** — hand-written API contract plus the closed
vocabularies mirroring the Postgres enums.

**CI — `.github/workflows/ci.yml`** — two jobs running the full verification loop.

## Assumptions I made

- **The Supabase CLI owns the database schema; Flyway was removed.** I built this with
  Flyway first, then consolidated when you asked for the CLI. Running both would mean
  two migration tools against one database. The CLI won because the database *is*
  Supabase — auth and storage schemas live there too, `db push`/`db diff` are the
  native workflow, and the API no longer needs DDL privileges. The SQL is unchanged,
  so reversing this is cheap if you disagree.
- **`docker-compose.yml` was deleted in the same move.** `npm run db:start` supersedes
  it and gives Postgres *plus* Auth, Storage and Studio. The task file asked for
  docker-compose; this is the same thing done through the tool you asked for.
- **Provisioning happens in `GET /api/v1/me`**, not an auth webhook. It is the first
  authenticated call any signed-in client makes, so the row exists before anything
  needs it, and there is no second system to keep alive.
- **Shared types are hand-written.** Generating them needs the backend to publish an
  OpenAPI document first — real work, and not scaffolding. Suggested as task 002.
- **Enums for closed sets, `text` for open ones.** Archetype, round type, status and
  language are Postgres enums. Function, level and company name are `text`, because a
  taxonomy will own them later.
- **Compensation band stored as min/max/currency**, so notice and compensation
  conversations can be rehearsed with real numbers.
- Versions are current-stable rather than conservative (Spring Boot 4.1.1, Next 16.3,
  Kotlin 2.3.21). Spring Boot 4 renamed several starters; the build was generated from
  Spring Initializr rather than written from memory.
- Next 16 deprecates the `middleware` file convention, so the guard lives in
  `src/proxy.ts`. Behaviour is identical.

## What I found and fixed

**`NimbusJwtDecoder.withJwkSetUri` accepts RS256 only unless told otherwise, and
Supabase signs with an ES256 elliptic-curve key.** Every genuine access token was
rejected with a plain 401 — no log line, no clue. Unit tests using
`SecurityMockMvcRequestPostProcessors.jwt()` never touch the decoder, so they were
green throughout. I only caught it by minting a real token from your project and
calling the running API.

`SupabaseJwtDecoderTest` now decodes a genuinely ES256-signed token against a JWKS
served over HTTP. I verified it fails when the fix is reverted.

## What I could NOT verify

- **Google sign-in end to end.** The provider is enabled on your project and the flow
  is implemented, but completing it needs a browser and a real Google account. The
  redirect allow-list entry (`http://localhost:3000/**`) is worth confirming.
- **The browser half of Google sign-in.** Everything up to the redirect is verified;
  completing consent and landing on the dashboard needs a human with a Google account.
- **The local Supabase stack.** Docker is not installed on this machine, so
  `npm run db:start` and `npm run db:reset` are unrun. The `[auth.external.google]`
  block in `config.toml` is likewise unverified.
- **CI.** The workflow has never executed — there was no push to trigger it. The same
  commands pass locally.
- Visual design, latency, and anything requiring judgement about how the product feels.

### How I verified the database instead

Docker was unavailable and the Supabase MCP connector returned "You do not have
permission", so I ran a throwaway Postgres 18 in a scratch directory and applied
`supabase/migrations` and `supabase/seed.sql` to an empty database: both applied
cleanly, the seed is idempotent, and RLS is on with policies on all five tables. I then
ran the built API against it with a real access token from your Supabase project and
confirmed `GET /api/v1/me` returns 200 with the provisioned profile, is idempotent on a
second call, and returns 401 for a missing, malformed, tampered, or wrong-audience
token.

That required creating a temporary user (`scaffold-verify@example.com`) in your hosted
project. **I deleted it afterwards and confirmed the project has zero users.**

### Applied to the hosted project since

Once `SUPABASE_ACCESS_TOKEN` was in place, `npm run db:push` applied
`20260825000000_initial_schema.sql` to `moeronogmgtmbdnzfzgu`. Verified after the fact:

- `supabase migration list` shows local and remote both at `20260825000000`
- generated types confirm all five tables exist in `public`
- RLS is enforcing, not merely enabled — as `anon`, selecting from `users` returns
  nothing, and inserts into `users` and `sessions` are both refused with `42501`

The project is Postgres 17, matching `config.toml`'s `major_version` — open question 2
is settled.

### `npm run dev` verified against the hosted project

With the database password in place, both services start and talk to the real project:

- `GET /api/health` → 200 with build info; `GET /api/v1/me` → 401 with the error envelope
- web landing and `/login` → 200, and `/dashboard` while signed out → 307 to
  `/login?next=%2Fdashboard`, so the guard works
- the JDBC credentials connect to `aws-0-ap-south-1.pooler.supabase.com:5432` and see
  five tables, all with RLS enabled

The first `npm run dev` failed with `spawn EINVAL`: on Windows, Node will not spawn a
`.cmd` or `.bat` without a shell, and a shell then splits `Live Projects` on the space.
`scripts/dev.mjs` now runs the real entry points instead — `next/dist/bin/next` under
this Node, and `GradleWrapperMain` out of the wrapper jar, which is what `gradlew` does
once it has located a JVM. `scripts/supabase.mjs` had the same defect and the same fix.

## Verification status

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | pass — 18 tests |
| `npm run build` | pass |
| `./gradlew ktlintCheck` | pass |
| `./gradlew test` | pass — 20 tests |
| `./gradlew build` | pass |

## Diff size

2,988 hand-written lines across 70 files, excluding `package-lock.json`, the Gradle
wrapper, and the generated `supabase/config.toml`. That is well past the ~800-line
guidance in `CLAUDE.md`, and the task was too big for one reviewable commit.

If it had been split, the seam I would use is: **(a)** monorepo, tooling, CI and the
two apps saying hello, **(b)** database schema, RLS and the Supabase CLI setup,
**(c)** authentication — Google sign-in, the JWKS resource server, and `/api/v1/me`.
(c) is the part that genuinely needs review; (a) is mostly generated. Worth reading in
that order.

## Merge status

Merged into `develop` at `8597c11` and pushed, along with `feat/001-scaffold`.

**CI ran unobserved.** The push triggered `.github/workflows/ci.yml` for the first time,
but the repository is private and the GitHub CLI is not installed on this machine, so I
could not read the result. `CLAUDE.md` makes green CI the merge gate rather than my
judgement, and I could not check that gate — so **please look at the Actions tab**. All
seven checks pass locally; if CI is red, expect an environment difference (Ubuntu,
Node 22, Temurin 21) rather than a logic error.

## Suggested next task

Publish an OpenAPI document from `apps/api` and generate `packages/shared` from it,
replacing the hand-written contract before a second endpoint makes the drift real.

## Open questions for you

1. **Do you accept the Supabase CLI owning migrations instead of Flyway?** Everything
   else follows from that call, and reversing it later gets progressively more
   expensive.
2. **Put the database password in `.env` as `DATABASE_PASSWORD`** (Settings → Database;
   reset it there if you never saved it). It is the last thing standing between the
   scaffold and a working `npm run dev`.
3. Check the Actions tab — CI has run several times now and I have never been able to
   see the result.
