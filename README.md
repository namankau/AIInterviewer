# InterviewOS

Voice-first AI mock interviews grounded in how interviews at real employers actually
run. The candidate names a company and a role at the start of each session and takes a
spoken interview conducted the way that employer runs one, then gets an
evidence-backed report.

Requirements live in [`docs/InterviewOS_PRD_v1.1.pdf`](docs/InterviewOS_PRD_v1.1.pdf).
Working agreements for this repository live in [`CLAUDE.md`](CLAUDE.md).

---

## Layout

```
apps/web            Next.js frontend (App Router, TypeScript, Tailwind)
apps/api            Spring Boot backend (Kotlin, Gradle)
packages/shared     TypeScript types for the public API contract
supabase/           Database schema, seed data and local-stack config (Supabase CLI)
docs                PRD and design notes
tasks               Task files for autonomous runs
scripts             Local development helpers
```

The database schema is owned by the Supabase CLI, in `supabase/migrations`. The API
reads and writes rows; it never runs DDL.

---

## Running it locally

You need **Node 20.12+** and a **JDK** (Gradle fetches Java 21 itself if you have a
different one).

### 1. Configure

```bash
cp .env.example .env
npm install
```

Fill in `.env` — both apps read this one file, and every key is documented there.

### 2. Point at a database

**Hosted Supabase** (the default; required for Google sign-in):

```bash
npx supabase login       # once per machine
npm run db:link          # once per clone; also sets up the IPv4 connection
npm run db:push          # applies supabase/migrations
```

Then set the `DATABASE_*` values in `.env` from **Dashboard → Connect → JDBC** (use the
session pooler host) and **Settings → Database** for the password:

```
DATABASE_URL=jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require
DATABASE_USER=postgres.<project-ref>
DATABASE_PASSWORD=<database password>
```

**Local stack** (needs Docker; gives you Postgres, Auth, Storage and Studio):

```bash
npm run db:start         # prints local URLs and keys
npm run db:reset         # applies migrations, then supabase/seed.sql
```

Point `.env` at it — `jdbc:postgresql://localhost:54322/postgres`, user `postgres`,
password `postgres` — and use the local URL and anon key it printed for the
`NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_URL` values.

### 3. Enable Google sign-in

Google is the only way in, so nothing works until this is configured. For the hosted
project, in the Supabase dashboard — **Authentication → Sign In / Providers → Google**:

1. Create an OAuth client in the Google Cloud console (type: *Web application*).
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
   URI there.
3. Paste the client ID and secret into Supabase and enable the provider.
4. Under **Authentication → URL Configuration**, add `http://localhost:3000/**` to the
   redirect allow list.

For the local stack, put the same client ID and secret in `.env` as
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` and add
`http://localhost:54321/auth/v1/callback` to the Google client's redirect URIs.

### 4. Start both apps

```bash
npm run dev
```

The API serves on [localhost:8080](http://localhost:8080), the web app on
[localhost:3000](http://localhost:3000). Sign in, and you land on an empty
authenticated dashboard.

Check the API on its own:

```bash
curl http://localhost:8080/api/health
curl -i http://localhost:8080/api/v1/me            # 401 without a token
curl http://localhost:8080/api/v1/me -H "Authorization: Bearer <access token>"
```

---

## Database workflow

**Always drive the CLI through `npm run db:*` or `npx supabase`, never a bare
`supabase`.** The CLI is pinned as a dev dependency so every machine and CI agree on a
version. A separately installed global CLI — via scoop, brew or the installer — will
usually be older, and an older CLI cannot parse a `supabase/config.toml` written by a
newer one. It fails like this:

```
failed to parse config: 'experimental' has invalid keys: pgdelta
```

That is a version mismatch, not a broken config. Use the pinned CLI, or update the
global one to match.

| Command | What it does |
|---|---|
| `npm run db:link` | Link this clone to the hosted project (once) |
| `npm run db:start` / `db:stop` | Local Supabase stack (Docker) |
| `npm run db:reset` | Rebuild the local database from migrations, then seed |
| `npm run db:push` | Apply pending migrations to the linked hosted project |
| `npm run db:diff <name>` | Write a new migration from local schema changes |
| `npm run db:lint` | Static checks on the schema |

Never edit an applied migration. Add a new one.

---

## Verification loop

Run before opening a PR. CI runs exactly this on every push.

```bash
# frontend and shared types
npm run typecheck && npm run lint && npm run test && npm run build

# backend
cd apps/api && ./gradlew ktlintCheck test build
```

---

## Conventions

- Branch as `feat/<slug>` or `fix/<slug>`, merge into `develop`. `main` is
  release-only.
- Conventional commits, referencing the PRD section: `feat: resume upload (PRD 05)`.
- Never commit `.env`. New secrets go into `.env.example` with an empty value.
