# Task 039 — The hidden AI question pool: foundation

PRD §03 (knowledge tiers), §04 (provenance), §08 (question archetypes), §10.
Read `CLAUDE.md` first — its rules apply, and **rule 7 applies hardest here**: this task
builds the generation job but **does not run it against Gemini**. Task 043 does, after the
owner approves the spend.

## Why

The sourced bank (task 035) only holds questions for companies somebody has published
about. For everything else a round falls back to archetype patterns written live, one
question at a time, in the gap between the candidate's answers.

The owner's decision (15 September): pre-generate a pool of questions from the model's own
knowledge, per company × round type × role family × level, store it, and let rounds use it
when the sourced bank has nothing for that company and round. It is faster in the room,
cheaper per round, and it can be reviewed before a candidate ever sees it.

The pool is **never listed in the UI**. It is not a browsable question bank — it is what a
round reaches for when nothing sourced exists.

## The rule this must not break

**A pool question is model knowledge and must be labelled as model knowledge, for ever.**

- The pool is a **separate table** from `bank_questions`. Not a flag on the same table, not
  a nullable `source_id`. There is no code path that writes a pool question into the bank or
  gives it a sourced company tag. Task 035's rule — a tag means a real employer asked it,
  backed by a fetched source — is exactly as true after this task as before it.
- **No scraped data.** The LeetCode company-wise repository and its like are not imported,
  not consulted, not used as a seed list. The pool comes from the model's own knowledge, and
  that is precisely what makes the label on it honest.
- The association with a company is `associated_with`, never "asked at". See the gate below.

## Build

### Schema — `supabase/migrations/20260915000000_question_pool.sql` (additive)

Check first whether `vector` is enabled on the project (`select * from pg_extension`); no
migration in `supabase/migrations/` enables it, so assume it is not and enable it here with
`create extension if not exists vector`. If that is not permitted, say so in the report and
fall back to fingerprint-only dedupe — do not ship a column nothing can index.

- **`pool_questions`** — id; `company_id` (FK → `companies`, **nullable**: a question
  generated for an archetype rather than a named employer); `archetype employer_archetype`
  (not null, so an archetype-level fallback always works); `round_type` (not null);
  `role_family` (not null); `level` (not null); `text`; `follow_ups text[]` (2–3, checked
  non-empty); `strong_answer_covers text[]`; `association` (below);
  `generator_version int not null`; `model text not null` (which model wrote it — the ledger
  says what it cost, this says what produced it); `embedding vector(<dim>)` nullable;
  `fingerprint` (reuse `public.question_fingerprint` from the bank migration — the same
  normalisation, not a second one); `reviewed_at timestamptz` nullable;
  `retired_at timestamptz` nullable; timestamps.
- `role_family` and `level` are enums, values from the PRD wave-1 list: role families
  `backend`, `fullstack_frontend`, `mobile`, `qa_automation`, `data_engineering`, `ml_ai`,
  `sre`; levels `entry`, `mid`, `senior`, `staff`. No PM, no consulting (`CLAUDE.md`: a new
  function vertical needs a rubric built with domain input first).
- **`association`** — `company_specific` | `employer_kind`. This is the gate:
  - `company_specific` is allowed **only** when the model is asked, separately and first,
    whether it actually knows this employer's interview process, and says yes with reasons
    (named rounds, named values, a named format). Store that answer.
  - Otherwise the row is `employer_kind`: generated for the archetype. `company_id` may still
    be set so a round can find it, but what the candidate is told talks about the kind of
    employer, never the company.
  - Enforce the gate in Kotlin on the way in, not only in the prompt. A model that returns
    `company_specific` for a company it just said it did not know is downgraded, and the
    downgrades are counted in the run report.
- **`pool_generation_runs`** — id, `started_at`, `finished_at`, `status`
  (`running` | `paused` | `finished` | `failed`), `generator_version`, `spend_cap_micro_usd`,
  `spent_micro_usd`, `note`.
- **`pool_generation_cells`** — one row per (run, company, round_type, role_family, level)
  with `status` (`pending` | `in_progress` | `done` | `skipped` | `failed`), `attempts`,
  `error`, `questions_written`, `duplicates_dropped`. This table is what makes the job
  resumable: a killed job restarts from `pending` and nothing is generated twice.
- Unique index on `(run_id, company_id, round_type, role_family, level)`; index on
  `(company_id, round_type, role_family, level)` where `retired_at is null` — the lookup
  task 042 makes on every round.
- RLS enabled, **no client policies**, as with `ai_calls` and the source library. The pool is
  never listed to a client; it is read server-side by the round.
- Comment the table with why it is separate from `bank_questions`. The next person to touch
  it will be tempted to merge them.

### Companies

Seed the owner's 40 into `companies` where missing (task 035 seeded a set; fill the gap),
with canonical names, slugs and archetypes:

- **US** — Google, Amazon, Microsoft, Meta, Apple, Netflix, Nvidia, Salesforce, Oracle,
  Adobe, Uber, Airbnb, LinkedIn, Intuit, PayPal, Stripe, Databricks, Snowflake, Pinterest,
  Dropbox.
- **Global** — Atlassian, Shopify, Spotify, Booking.com, Adyen, SAP, Zalando, Cloudflare,
  GitLab, Wise.
- **India** — Flipkart, Swiggy, Zomato, Razorpay, Zerodha, Freshworks, Zoho, CRED, Meesho,
  PhonePe.

List in your report which you added and which already existed.

### Kotlin — new package `com.interviewos.api.pool`

- `PoolQuestion`, `PoolCell`, `RoleFamily`, `Level`, `Association` models.
- `QuestionPoolRepository` — write a batch for a cell; read by
  (company, round type, role family, level) with archetype fallback; count coverage; retire.
- `QuestionGenerator` — the interface tasks 040 and 041 implement, one per round type. Define
  it here and ship **one** reference implementation so the job is testable end to end: pick
  the simplest (HR/fit) and leave the rest to 040/041.
- `PoolGenerationJob` — the resumable driver. For each pending cell: call the generator,
  dedupe, write, mark the cell, record spend.
  - **Rate limited** — configurable requests-per-minute and a small concurrency, both under
    `interviewos.pool` in `application.yml`. Default conservative.
  - **Spend cap** — the run carries `spend_cap_micro_usd`; before each call the job sums what
    the run has spent (from `ai_calls`, with the run id recorded against the call) and moves
    the run to `paused` when the next call could exceed it. A cap checked after the money is
    gone is not a cap. Prove it with a test.
  - Every call goes through the existing `InterviewAi` chain so `ai_calls` records it. Do not
    add a second HTTP path to Gemini.
  - The job is **not** scheduled and **not** started on boot. It is triggered explicitly, and
    this task never triggers it against a real key.
- `PoolDeduplicator` — fingerprint first (exact, free), then embeddings: Gemini's embedding
  model through the existing provider config, cosine similarity over `vector`, threshold a
  configurable property with a documented default. Deduplicate within the cell, against
  everything already stored for that company and round type, and against `bank_questions` —
  if the model reproduces a sourced question, the sourced row wins and the pool row is
  dropped, never the other way round. Unit-test with fixed vectors; no live embedding call in
  tests.
- `PoolProperties` — `@ConfigurationProperties("interviewos.pool")`: `enabled` (default
  false), rate limit, concurrency, dedupe threshold, default spend cap, embedding model.

### Admin-only trigger and export

The owner reviews a sample before the full run (task 043), so there must be a way to get the
questions out without a UI.

- Both are **admin-only**, never candidate-facing. Use whatever admin check the codebase
  already has; if there is none, gate on a configured admin user-id list under
  `interviewos.pool` and **say in your report that this is the weakest part of the task** —
  do not invent an auth scheme.
- `POST /api/v1/admin/pool/runs` — start or resume a run (companies, round types, role
  families, levels, spend cap). Returns the run.
- `GET /api/v1/admin/pool/runs/{id}` — status and cell counts.
- `GET /api/v1/admin/pool/runs/{id}/export` — a **file** (JSONL or CSV, your call, justify
  it) of every question the run wrote with its company, round type, role family, level,
  association, follow-ups and what a strong answer covers. This is what the owner reads.
- Integration tests for each: happy path and an auth-failure path (`CLAUDE.md`).

## Not in this task

The coding and system-design generators (040). Behavioural, fundamentals, HR, case and
techno-managerial generators (041), beyond the single reference generator. Rounds using the
pool, the report label, hiding `/questions` (042). Running the job against Gemini (043).

## Done when

The migration is written (the orchestrator applies it), the pool tables and the job exist
with the spend cap and resumability tested, dedupe is unit-tested against fixed vectors, the
admin endpoints are tested including their auth-failure path, **no live model call was
made**, CI is green on `feat/question-pool`, and the report lists the companies seeded, the
embedding dimension chosen, and how the admin gate works.
