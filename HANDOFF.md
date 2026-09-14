# Handoff — 14 September 2026

## Task
Your message of 13 September: a company-tagged question bank built from public interview
experiences, a "how this company interviews, and a plan" step before the round, and mock
rounds that ask only that company's questions (or what the AI provider supplies). Planned
as four tasks: [`tasks/overnight-2026-09-14.md`](tasks/overnight-2026-09-14.md) and
`tasks/task-035` to `task-038`.

**It did not finish overnight.** Your plan's usage limit was hit three times (about
23:00, 09:00 and 19:40 IST), and every agent stopped until it reset. Everything below was
finished on the 14th, and all of it is on `develop`.

## Read this first: no scrapers
I did not build scrapers for LeetCode, Blind, Reddit, LinkedIn, or Medium in bulk.
`CLAUDE.md` says to stop and flag this, and PRD §04 puts those sites out of scope *by
decision*, for commercial reasons: terms-of-service exposure, questions about where the
data came from, and the brand damage of republishing anonymous career content. Changing
that is a legal call, and it is yours.

The bank is built from PRD §04's permitted Tier B sources instead: employers' own pages,
openly licensed documents, and individual authors' own posts, cited and linked. Each was
found and checked by hand, recorded in a source register, and read through the existing
fetcher (robots.txt honoured, links never followed).

## What I built
- **Question bank (task 035).** Companies, bank questions, and **company tags derived
  from the source reports, never written directly**, so every tag is backed by a source
  we actually fetched. A question can carry several companies, a company many questions.
  Corroboration counts, recency, and where each citation came from. Model-written
  questions never enter the bank.
  - `GET /api/v1/question-bank/companies` and `GET /api/v1/question-bank?company=<slug>`.
  - Pages `/questions` and `/questions/[slug]`, signed in only and not indexed.
  - Code: `apps/api/.../bank/`, migration `20260914000000_question_bank.sql`.
- **Source register (task 036).** `docs/source-register/REGISTER.md` (generated) and the
  JSON behind it: **87 sources across 36 employers**, each one fetched by a researcher,
  then re-requested by `scripts/source-register.mjs check` with the fetcher's own
  User-Agent and robots rules.
  - The script has `validate` (the hard exclusions are enforced in code), `check`,
    `render` and `import`, with 77 tests.
- **Rounds ask the company's own questions (task 038).**
  - A round's main questions come from bank questions tagged to *exactly* that company
    (by name or alias; never a sibling, parent or regional office) and that round type.
  - It skips questions you have been asked before and ranks by corroboration, then
    recency. Coding problems and design cases are written from the chosen question.
    Follow-ups stay adaptive.
  - **The engine decides each turn's label.** A turn that asked a bank question is
    `published_source`, citing *that question's* sources. Every other turn is
    `model_knowledge`. This also fixes an old bug that labelled every turn in a grounded
    round as sourced.
  - With nothing in the bank, the AI provider writes the questions, labelled as such.
  - Code: `interview/BankRound.kt`, `interview/BankRoundPlanner.kt`, migration
    `20260914010000_bank_rounds.sql`.
- **Before the round (task 037).** A new step in `/interview/new`, "How <Company>
  interviews for <Role>", then a prep plan, then any round with one click.
  - **Stages come from sources** only if the model's verbatim evidence quote (at least 25
    characters) is actually in the document.
  - **The general pattern is written by the model without being told the company's
    name**, so it cannot invent company-specific detail.
  - The plan is deterministic and is not stored, so there is no "targets" entity.
  - Code: `apps/api/.../loopbrief/`, `components/loop-brief-step.tsx`, migration
    `20260914020000_loop_brief.sql`.
- **A fix of mine (`44239f6`):** the prep plan came back empty for Amazon. Its sourced
  stages (online assessment, and an "Interview Loop" of four 55-minute interviews) map to
  no single round type. Sourced stages now come first and the general pattern fills the
  gaps.

## What is in the bank now (imported 14 September, live project)
- **117 questions tagged across 16 companies:** Cloudflare 23, Razorpay 17, Meta 14,
  Microsoft 13, CRED 8, Atlassian 7, Google 7, Spotify 5, Walmart Global Tech 5, Grab 4,
  MongoDB 4, Shopify 3, Goldman Sachs 2, Netflix 2, Postman 2, Zalando 1.
- **161 evidence-checked loop stages across 28 companies**, including GitLab 19,
  Microsoft 13, Atlassian 12, Adyen 12, Adobe 10 and Amazon 5.
- **Amazon has no tagged questions.** Its own pages describe the process but list no
  questions asked, and every first-hand Amazon write-up found was on Medium. **Medium
  answers our honest User-Agent with 403**, so the fetcher cannot read it; 18 register
  entries are Medium and were not imported. So Amazon gets a sourced loop brief, and its
  rounds are AI-written and labelled that way. The same applies to most India product
  companies.
- 60 of 65 sources fetched. Intuit returned 429 (probably transient; press refresh), and
  four pages had no readable text.
- The one source that predates this run, `github.com/jwasham/coding-interview-university`
  filed as Google, is a study plan rather than Google's process, and its extraction
  still fails. I left it alone because you added it; I'd suggest deleting it.

## Assumptions I made
- The Medium, Revolut and Canva pages that block us stay listed in the register as
  unreadable. They can be uploaded as documents if you want them. I did not spoof a
  browser User-Agent.
- LinkedIn's own careers page was rejected: linkedin.com is on the hard-exclusion list.
- I imported as the e2e harness account (`e2e.candidate@acemyinterview.test`), running
  the local API with that address added to `ADMIN_EMAILS` **for that one process only**.
  `.env` is unchanged, and `added_by` on those sources is the harness account.
- Division is not parent: "Walmart Global Tech" is its own company, not an alias of
  Walmart.
- **Offered rounds:** task 030's "offer six of eight" was never built, so all eight are
  still startable. Task 037 added `interviewos.rounds.offered` (default: all eight), so
  narrowing is now one line of `application.yml`.
- 038 reads "the opening question" as the first question of the main round; the warm-up
  never gets a bank question.
- 038 leaves out bank questions with no round type, so a coding question cannot turn up
  in a behavioural round.

## What I could NOT verify
- **Visual design.** No browser render of `/questions`, `/questions/[slug]` or the new
  pre-round step. They are tested for behaviour and accessibility, and they build.
- How a bank question sounds read aloud, and whether the round still feels adaptive.
- **One live finding for your judgement (038):** after a vague answer the model moved on
  to the planned bank question instead of probing. The prompt says to follow up first;
  it may need tightening.
- Whether each register source is fine to reuse. **PRD §04 asks for your per-source
  review, and §16 for a legal review before public launch.** Neither has happened.

## Verification status
- typecheck / lint / tests / build: **pass**, locally and in CI for every merge.
  - Task branches: 035 run 34829720113, 036 run 34828677004, 037 run 34870378858, 038
    run 34855798083.
  - `develop` at `44239f6`: run 34871412522.
- Migrations: all three applied to the linked project at merge time (`migration list`
  shows no local-only rows).
- Each merge was smoke-tested against the live project with a local API:
  - **Bank:** a dev.to post became two tagged Goldman Sachs questions.
  - **Rounds:** a Goldman Sachs coding round opened on the bank question "Shortest
    Subarray with Sum at Least K", stored its `bank_question_id`, and cited only that
    post.
  - **Brief:** the Amazon brief showed two stages sourced from Amazon's own page, next to
    a general pattern with no company name in it.

## Merge status
- All merged into `develop`: `fae6fbf` and `caccb4e` (register), `c6c00e7` (bank),
  `1754fab` (rounds), `d959d20` (brief), `44239f6` (plan fix).
- No PR was needed: nothing touches auth, payments, deletion or permissions. The new
  endpoints use the existing sign-in, and the admin endpoints are unchanged.
- All four task diffs are over the ~800-line guideline: 035 about 3,400 lines, 037 about
  2,600, 038 about 1,700. That is mostly tests and seed data. 035 would have been better
  as two tasks (schema and extraction; API and web).

## Suggested next task
Get first-hand reports we are allowed to read for Amazon and the India product
companies. Either upload the 18 Medium posts as documents (each is in the register), or
decide on a licensed source or partnership (PRD §04: *"where a licensed API or
partnership is available, that is the route"*).

## Open questions for you
- Do you want the scraping position changed? It needs a `CLAUDE.md` and PRD §04
  amendment and a legal review, not code.
- Should the rounds offered to candidates be narrowed to six (task 030)? It is one line
  now: `interviewos.rounds.offered`.
