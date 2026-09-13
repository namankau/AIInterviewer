# Task 035 — A company-tagged question bank

PRD §04 (tiers, source register), §08 (question archetypes, corroboration, recency), §10.
Part of the overnight run: read [`overnight-2026-09-14.md`](overnight-2026-09-14.md)
first — its rules apply to this task.

## Why

The owner wants Amazon-tagged questions visible at a glance. A question reported at Amazon
and at Microsoft carries both tags, and a company carries many questions.

Today the library (`20260907120000_source_library.sql`, `apps/api/.../sources/*`) stores
each extracted question against a single free-text `company_name`, matched exactly and
case-insensitively. There is no canonical company, no merging of the same question across
sources, no corroboration count, and nothing a candidate can browse.

## The rule this must not break

A tag says a real employer asked a question. **Every company tag must be backed by at
least one fetched source that says so.** So tags are never written directly — they are
*derived* from reports (source S says question Q was asked at company C). Deleting a
source removes its reports, and a tag left with no report disappears on its own.

**Questions the model writes never enter the bank.** Not the ones from rounds, not
"suggested" ones, not placeholders for companies with no sources. That would launder model
knowledge into a sourced claim — the failure `CLAUDE.md` calls the most damaging this
product has.

## Build

### Schema — `supabase/migrations/20260914000000_question_bank.sql` (additive)

- **`companies`** — id, `slug` (unique), `name`, `aliases text[]` (lower-cased exact names
  for the *same* employer, such as `facebook` for Meta — never a subsidiary, region or
  division; "Google Cloud India" is not Google, the rule `SourceRepository.questionsFor`
  already states), `archetype employer_archetype` (nullable), timestamps. Seed every
  employer in `ArchetypeResolver.KNOWN`, plus the major product software employers the
  owner means (Meta, Apple, Netflix, Nvidia, Salesforce, Oracle, LinkedIn, Stripe, Airbnb,
  Databricks, Snowflake, Shopify, Dropbox, Pinterest, Intuit, PayPal, PhonePe and so on —
  use judgement, and list what you seeded in your report).
- **`bank_questions`** — id, `text` (canonical wording), `fingerprint` (unique; normalised
  text — define the normalisation once, implement it identically in SQL for the backfill
  and in Kotlin, and test that the two agree), `round_type` (nullable), timestamps.
- **`source_questions`** becomes the report table: it gains `bank_question_id` (FK →
  `bank_questions`; cascade or set null, choose and justify) and `company_id` (FK →
  `companies`). Existing rows are backfilled.
- **`interview_sources`** gains `origin` — `employer` (the employer's own published page),
  `open_licence` (an openly licensed repository or document), `author` (an individual's own
  post, used with attribution); nullable for legacy rows — and `extractor_version int not
  null default 1`. (`published_on` already exists.)
- Tags are **derived**: a view or query giving (bank question, company, corroboration =
  distinct fetched sources, last reported = latest `asked_on`, else `published_on`). Only
  `fetched` sources count.
- RLS enabled, no client policies — the library's posture (the API reads as owner).

### Extraction

- `extract-questions` returns, per question, `companies: string[]` — every named employer
  the document says asked it; empty if none is named — instead of one `companyName`. Never
  a group ("FAANG", "MAANG", "big tech", "product companies"): say so in the prompt and
  enforce it with a small deny-list in Kotlin.
- Company resolution on write: exact, case-insensitive match on name or alias. If the text
  names no employer, use the source's declared company. If it names one we do not have,
  create it (slug from the name) — the name came from a real document.
- Deduplicate on fingerprint: the same question from two sources becomes one bank question
  with two reports, which is corroboration 2. Near-duplicate clustering (embeddings;
  pgvector is already in the stack) is a follow-up, not this task — say so in the report.
- `EXTRACTOR_VERSION` constant, `2` in this task. `SourceFetcher` re-extracts a source whose
  `extractor_version` is behind even when its content hash is unchanged — otherwise every
  existing source keeps the old shape for ever. Task 037 bumps it again.
- `AddLinkRequest` accepts optional `origin` and `publishedOn` (ISO date); task 036's import
  sends both.

### Kotlin — new package `com.interviewos.api.bank`

Tasks 037 and 038 build on this, so make the seams obvious:

- `CompanyDirectory` — `resolve(name): Company?` (exact name or alias, never fuzzy) and
  `bySlug(slug)`.
- `QuestionBankRepository` — a company's questions (optionally one round type), each with
  all its company tags, its citations (`ProvenanceSource`, plus origin), corroboration and
  recency; coverage per round type for a company; lookup by id.
- Keep `SourceGrounding.forRound` working on the new tables, through `CompanyDirectory`.
  Task 038 rewrites how rounds use the bank — do not do its work here.

### API — signed-in candidates only

No public endpoints. Republishing extracted third-party text on public, indexable pages is
a legal-posture call for the owner (PRD §16); flag it in the report as a follow-up, do not
build it.

- `GET /api/v1/question-bank/companies` — companies with at least one sourced question:
  slug, name, archetype label, question count, count per round type.
- `GET /api/v1/question-bank?company=<slug>&roundType=<rt>&limit=&offset=` — questions,
  each with text, round type, **all** its company tags (slug, name, corroboration, last
  reported), citations (title, publisher, url, year, origin), and tier `published_source`.
  Filtering by Amazon still shows that a question also carries Microsoft.
- Integration tests for each: happy path and unauthenticated 401 (`CLAUDE.md`).

### Web

- `/questions` — the companies with their counts, as a typographic index (not a grid of
  identical cards).
- `/questions/[slug]` — that company's questions, filterable by round type. Each shows its
  company tags (linking to those companies' pages), "reported in N sources", recency, and
  citations with links and origin — "Amazon's own careers site" reads differently from "a
  published account by <publisher>", and it should.
- An honest empty state: for a company with nothing sourced, rounds run on general
  patterns for its archetype, and the page says so.
- The rail nav gains "Questions". Types go in `packages/shared`. Behaviour and
  accessibility tests, no snapshots. Check it at phone width. Read `CLAUDE.md` "Design
  direction" before writing JSX.

## Not in this task

Choosing round questions from the bank (038). Extracting loop structure (037). Finding
sources (036). Public SEO pages. An admin UI. Embedding-based clustering.

## Done when

The migration is written (not applied — the orchestrator applies it), extraction writes
bank rows with tags, both endpoints are tested, the pages are built and tested, CI is green
on `feat/question-bank`, and the final report follows the overnight rules.
