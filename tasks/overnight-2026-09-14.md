# Overnight run — 13 → 14 September 2026

Planned 13 September, late, from one message from the owner, who then went to sleep and
asked for the work to be done by morning without waiting for them. Four tasks, run by
agents in parallel where they do not collide, merged into `develop` one at a time.

## What the owner asked for

1. **A question bank for product software companies**, built from public interview
   experiences — FAANG and every other major engineering employer — tagged by company.
   Amazon-tagged questions should be easy to see. A question may carry many companies,
   and a company many questions.
2. **Before the interview**, when a candidate says what they are preparing for: lay out
   how that company interviews for that role, lay out a plan, then offer a mock interview
   of whatever kind they want.
3. **In the mock interview**, ask only questions tagged to that company in our bank — or
   what the AI provider supplies at that point.

They suggested LeetCode, Blind, Reddit, Medium and LinkedIn as sources, and asked for the
work to follow `CLAUDE.md`.

## The one part not done as asked

**No scrapers.** `CLAUDE.md`: *"Do not write scrapers. Bulk scraping of LeetCode, Blind,
Reddit, Glassdoor, AmbitionBox, or GeeksforGeeks discussion content is out of scope by
decision, not oversight. If a task seems to require it, stop and flag it in HANDOFF.md."*
PRD §04 lists the same sites as *explicitly out of scope*, for commercial reasons rather
than caution — terms-of-service exposure that survives even where scraping is lawful,
procurement and app-store provenance questions, and the brand damage of one complaint
about republished anonymous career content. LinkedIn and Blind prohibit scraping in their
terms; LeetCode's company tags are its paid product. Whether to change that position is a
legal-posture decision, which `CLAUDE.md` reserves for the owner.

What the bank is built from instead is PRD §04's own answer: **employer career-site
process pages, openly licensed repositories, and individual authors' own posts used with
attribution** — each one found and checked by hand, recorded in a source register (PRD
§16), and read through the existing `SourceFetcher` (robots.txt honoured, links never
followed, nothing discovered). Medium is in, one attributed post at a time; Medium in
bulk is not.

## Tasks

| Task | What | Depends on | Branch | Migration |
|---|---|---|---|---|
| [035](task-035-question-bank.md) | Company-tagged question bank | — | `feat/question-bank` | `20260914000000_question_bank.sql` |
| [036](task-036-source-register.md) | Source register: research, record, import tooling | — (import runs last) | `feat/source-register` | none |
| [037](task-037-loop-brief.md) | How this company interviews, a plan, then any round | 035 | `feat/loop-brief` | `20260914020000_loop_brief.sql` |
| [038](task-038-bank-driven-rounds.md) | The round asks the company's questions | 035 | `feat/bank-driven-rounds` | `20260914010000_bank_rounds.sql` |

The register's import runs after 035 and 037 are merged, so every source is read once, by
the final extractor.

## Rules for every agent in this run (on top of `CLAUDE.md`)

- **Your own worktree, your own branch. Push the branch. Do not merge into `develop`, do
  not push `develop`, never touch `main`.** The orchestrator merges, one branch at a time,
  after checking CI.
- **Do not run `npm run db:push` or apply a migration anywhere.** The orchestrator applies
  each one at merge time, against the linked project, and may rename your migration's
  timestamp to keep the order straight. Write migrations **additive** — new tables, new
  nullable or defaulted columns — so applying one before its code lands breaks nothing.
- **Do not run the API against the linked database.** Your migration is not applied there,
  and the source refresh job starts writing to it two minutes after boot. Live checks of a
  prompt against Gemini are fine through a test harness, as earlier tasks did, using the
  key in the main checkout's `.env` — read it in place; never copy it into your worktree or
  commit it.
- **CI is the gate.** After pushing, find your branch's run (`gh run list --branch <b>`),
  watch it (`gh run watch <id> --exit-status`), and fix until both jobs are green. Report
  the run id. If you cannot get it green, say so plainly and say why — do not weaken a test.
- **Do not edit `HANDOFF.md`.** Put everything it needs in your final report: what you
  built (paths), every assumption, what you could not verify, verification status, the
  green CI run id, and the names of anything a later task will call.
- Worktree setup: `npm ci` at the worktree root before web checks; the web build uses CI's
  placeholder env (see `.github/workflows/ci.yml`). Backend: `cd apps/api && ./gradlew
  ktlintCheck test build`.
- Keep the diff reviewable (`CLAUDE.md`: about 800 changed lines, data files aside). If
  yours must be larger, say why in the report.
- Conventional commits with the PRD section, ending with the `Co-Authored-By` line.
