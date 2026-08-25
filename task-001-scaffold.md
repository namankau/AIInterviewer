# Task 001 — Project scaffold and authentication

**Run type:** unattended overnight
**Target branch:** `feat/001-scaffold` → merge into `develop` when green
**PRD reference:** §05 (profile model), §11 (stack), §13 (mobile-readiness rules)

Read `CLAUDE.md` first. Everything in it applies. This file only describes what to
build tonight.

---

## Goal

Stand up the empty shell of the product: a monorepo, a running Next.js frontend, a
running Spring Boot backend, Google sign-in working end to end, the core database
schema, and green CI. No interview functionality tonight. No voice. No UI polish
beyond a clean, coherent baseline.

Success means: the owner clones `develop`, runs one documented command, signs in with
Google, lands on an empty authenticated dashboard, and CI is green.

---

## Scope

### 1. Monorepo structure

Create the layout described in `CLAUDE.md`. Add a root `README.md` documenting how to
run the whole thing locally in as few steps as possible — assume the reader has Node,
a JDK, and Docker, and nothing else configured.

### 2. Frontend — `apps/web`

- Next.js (App Router) with TypeScript, strict mode on.
- Tailwind configured with a small design token set: one accent colour, a type scale,
  and spacing. Keep it restrained per the design direction in `CLAUDE.md`.
- Routes: `/` (public landing placeholder), `/login`, `/dashboard` (authenticated,
  empty state only).
- An auth guard that redirects unauthenticated users away from `/dashboard`.
- Scripts wired: `dev`, `build`, `typecheck`, `lint`, `test`.

Do not build the landing page content, the session UI, or the report UI tonight.
Placeholders are correct.

### 3. Backend — `apps/api`

- Spring Boot with Kotlin, Gradle.
- Health endpoint at `/api/health` returning build info.
- `GET /api/v1/me` returning the authenticated user's profile, 401 when
  unauthenticated. This is the first endpoint of the versioned public API described in
  `CLAUDE.md` — the mobile apps will consume the same one, so design it accordingly.
- JWT verification against Supabase-issued tokens.
- Flyway (or equivalent) migrations checked into the repo.

### 4. Authentication

- Supabase Auth with Google OAuth as the only provider.
- Frontend obtains the session; backend verifies the JWT independently. The backend
  must never trust a user ID sent from the client.
- On first sign-in, create the user's profile row.

### 5. Database schema

Create migrations for the entities below. Only the schema tonight — no business logic.
Row-level security on every table containing user data.

- **`users`** — id, email, display name, preferred interview language, created/updated.
- **`profiles`** — one-to-one with users. Function, current level, target level, total
  experience, location, relocation intent, work-authorisation status, notice period,
  compensation expectation band.
- **`resumes`** — user-owned. Storage object reference, original filename, parse
  status, parsed JSON payload, uploaded timestamp. Parsing itself is a later task.
- **`skills`** — user-owned. Skill name, self-rated confidence, whether detected in
  the resume, flagged-as-weak boolean.
- **`sessions`** — the interview session record. User, company name, company archetype,
  role, round type, chosen language, status, started/ended timestamps.

**Read this carefully:** there is deliberately **no** `targets` table. Company and role
live on the session row, chosen at session start. Progress views are derived by
grouping completed sessions by company and role. Do not create a targets entity, a
target-list endpoint, or a "my targets" UI concept. If something seems to need one,
it doesn't — note it in `HANDOFF.md` instead.

### 6. Shared types — `packages/shared`

TypeScript types for the API contract, generated from the backend schema rather than
hand-maintained if that is achievable cleanly. If generation adds meaningful
complexity tonight, hand-write them and note it.

### 7. CI

GitHub Actions running the full verification loop from `CLAUDE.md` on every push. CI
must be green before you merge to `develop` — this is the gate, not your judgement.

### 8. Local development

`docker-compose.yml` bringing up Postgres with pgvector. Seed script creating one test
user. `.env.example` listing every required key with empty values.

---

## Out of scope tonight

Do not build, scaffold, or stub: the voice pipeline, RAG or retrieval, resume parsing
logic, interview session logic, scoring, reports, payments, the contribution flow, or
any employer or question seed data.

---

## Definition of done

- [ ] `docker-compose up` then one documented command starts both apps
- [ ] Google sign-in works end to end; `/dashboard` is reachable only when signed in
- [ ] `GET /api/v1/me` returns the profile, and 401 without a valid token
- [ ] All migrations apply cleanly from empty; RLS enabled on user-data tables
- [ ] Typecheck, lint, tests, and build all pass for both apps
- [ ] No secrets in tracked files; `.env.example` complete
- [ ] `README.md` accurate enough that a fresh clone works
- [ ] `HANDOFF.md` written per the template in `CLAUDE.md`
- [ ] Merged into `develop`, or branch pushed unmerged with the reason stated

---

## Notes for the run

- Prefer boring, well-documented choices. This is scaffolding; novelty here costs more
  than it earns.
- If Supabase local development proves awkward against the Dockerised Postgres, use
  hosted Supabase for auth and document the tradeoff rather than burning hours on it.
- Keep the total diff reviewable. If it exceeds roughly 800 lines, say so in
  `HANDOFF.md` and suggest where task 002 should split.
