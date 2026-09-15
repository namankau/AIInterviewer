# Handoff — 15 September 2026

## Task
The hidden AI question pool, as you set it out on 15 September. Task files are
`tasks/task-039-question-pool.md` to `tasks/task-043-generation-run.md`. The run log is
`runs/2026-09-15-progress.md` (gitignored).

**Where it stands:**
- 039, 040, 041 and 042 are merged into `develop`, with every migration applied.
- 043 has not started. It spends money, so it needs your go-ahead.
- Nothing has called Gemini, and no mock round was run.

## Your four fixes (after you looked at the running app)
1. **The Questions tab was still showing** because 042 was waiting in PR #7. I took out
   042's sign-in change, which you hadn't asked for and which was the only reason it needed
   your review (`046ffa8`). CI passed, and I merged PR #7 at `753eec7` and applied its
   migration. `/questions` is hidden unless `NEXT_PUBLIC_QUESTION_BANK_BROWSABLE=true`.
   **Restart the API to see it.**
2. **The loop brief said too much.** It stated the caveat three times, gave a whole block to
   a sourced record that said nothing, and had a Question bank section that only said it
   was empty. Now the caveat appears once, the Question bank section is gone, and a
   content-free record becomes a quiet "Based in part on: …" citation. Merged at `add3447`.
3. **Back navigation** (same merge). "← Back to how <Company> interviews" returns from round
   setup to the brief, and "Edit the description this was built from" returns from the
   brief to the one-line input.
4. **A better answer for every question in the report.** The prompt only annotated "the
   weaker answers", and the improvement field could come back empty. Now:
   - every answered question gets a "How you could have answered it better" note, and the
     field is required;
   - the list of questions is built from the interview itself, so a question the model
     skipped still appears, with "No note was written for this answer.";
   - the prompt forbids inventing the candidate's experience;
   - pool questions pass the model their "strong answer covers" points as reference only.

   Merged at `4d3f749`; CI passed on the merged `develop` (run 34982216345). Warm-up
   questions get no note. Old reports render as before, with the same fallback text.
   **Needs a live check you haven't approved yet:** whether the notes are actually good,
   and the cost, which I estimate at a few hundred extra output tokens per report.
   Neither is measured.

## What I built

**039 — pool foundation** (merged at `7e4e091`, migration applied)
- `pool_questions` is its own table, kept apart from `bank_questions`. There is no code path
  from the pool into the bank, so a generated question can never pick up a sourced company
  tag. The table comment says why.
- Runs and cells:
  - `pool_generation_runs` and `pool_generation_cells` make the job resumable; a job that
    dies restarts from its pending cells.
  - `ai_calls.pool_run_id` means a run's spend is a query over the existing ledger.
  - The spend cap is checked **before** each call.
- Dedupe checks the exact fingerprint first, then embeddings (`gemini-embedding-001`, 768
  dimensions, threshold 0.90). It also checks against the sourced bank, and the sourced
  question always wins.
- Admin-only routes under `/api/v1/admin/pool/runs` start or resume a run, show its status,
  and **export it as JSONL**. The export is how you will review the sample.
- Generation is off by default (`POOL_GENERATION_ENABLED`). With it off, starting a run only
  plans it.
- Code: `apps/api/src/main/kotlin/com/interviewos/api/pool/`.

**040 — coding and system design** (merged at `859d4de`, migration applied)
- Coding reuses the existing `composeProblem` and `ProblemVerifier`. A problem whose own
  reference solution fails its tests is never stored.
- System design reuses `composeCase`. Each case is tagged `machine_coding` (entry and mid)
  or `distributed_design` (senior and staff).
- Both store their details in a new `pool_questions.payload jsonb` column, and both are
  always `employer_kind`.

**041 — behavioural, fundamentals, HR, case, techno-managerial** (merged at `e3f5715`)
- Behavioural questions map to a company's values only when the knowledge check named that
  value first.
- Techno-managerial is generated sparsely at lower levels: entry gets ¼ of the batch, mid ⅔,
  senior and staff the full batch.
- **A fix I asked for before merging (it also changes 039's merged code):** a question that
  claims to be about a specific company, and whose claim is refused, is now **dropped**.
  Before, it was relabelled `employer_kind` and kept. The text had been written around the
  claim, so relabelling left an invented value credited to a real employer, for example
  "…Bias for Speed, one of Amazon's leadership principles". Drops are counted in the run's
  note.

**042 — rounds use the pool** (PR #7, not merged)
- Rounds try the sourced bank first, then the AI pool, then live AI.
- No candidate is asked the same question twice from either store, across sessions.
- Pool coding problems are built from the stored, pre-verified payload, with no compose or
  verify step.
- The report label, as you specified: *"Generated by our AI interviewer from general
  knowledge. Not a verified report of a question Amazon asked."* For a company the model
  does not know well, the wording names the kind of employer instead.
- `/questions` is behind `NEXT_PUBLIC_QUESTION_BANK_BROWSABLE`, which is off. The pages
  return 404, and the nav entry, the loop-brief link and the list endpoints are gone.
  Rounds still use the sourced bank.
- It also fixes a bug in 039's `QuestionPoolRepository.find()` that let other companies of
  the same archetype through.

## Assumptions I made
- **Coding and design write at most one question per company × role × level**, not the
  configured 6. Each question is its own model call, and running several inside one cell
  could spend past the cap before the job's next check. So coverage for those two round
  types will be thin, and you may want to change this after seeing the sample.
- The admin gate reuses the existing `ADMIN_EMAILS` allow-list rather than a new auth
  scheme.
- The 17 companies whose archetype is unset (Nvidia, Stripe, PhonePe and others) were left
  unset. The resolver infers their archetype instead of a migration deciding it.
- Role family and level for a round are inferred from the role title, then from the resume.
  A title that matches no role family gets no pool question.
- 042's employer-kind label swaps the company name for an archetype phrase. You only gave
  the company sentence.

## What I could NOT verify
- **Anything live** (rule 7): whether the prompts produce realistic questions, whether the
  knowledge check says "no" often enough, whether 0.90 is the right dedupe threshold, the
  real latency saved on a pool coding round, and how English-only pool questions do in
  Hindi-English rounds.
- **The recorded spend is a floor, not an exact figure.** The embedding calls may not
  report their token usage, so they may be logged at zero cost. Keep that in mind when you
  read 043's costs.
- **The pool's application wiring has never booted.** This repo has no `@SpringBootTest`,
  so CI never assembles the new pool components into a running application.
- **The admin gate is weak:**
  - It is a flat list with no roles, so anyone on it can start spend.
  - It trusts the email in the sign-in token, and that email can be changed at the identity
    provider and need not be verified.
  - Nothing records who started a run.
  - Decide whether that is good enough before 043 spends money through it.
- **A behavioural-generator drop is logged but not counted in the run report.** The
  question is still never stored; you just won't see those drops in the run's count.
- **Realism is your judgement** (CLAUDE.md, things that need a human).

## Verification status
- CI passed (typecheck, lint, tests, build) on the exact commit of every merge or PR:
  - 039: run 34938599299
  - 040: run 34967080223
  - 041: run 34967802965 (includes 040)
  - 042: run 34970987146 (includes 041)
- I checked the migrations for 039 and 040 against the remote database after applying them.
  pgvector is enabled, `pool_questions.embedding` and `payload jsonb` exist, and
  `ai_calls.pool_run_id` is there.

## Merge status
- 039: merged into `develop` at `7e4e091`, migration applied.
- 040: merged at `859d4de`, migration applied.
- 041: merged at `e3f5715`, no migration.
- 042: merged at `753eec7` after its sign-in change was reverted, migration applied.
- The loop-brief fix is merged at `add3447` and the report fix at `4d3f749`. Neither has a
  migration.
- **Every task came in over the ~800-line guidance:** 039 about 4,960 lines, 040 about 990,
  041 about 1,140, 042 about 1,890. 039's admin endpoints and export, and 042's `/questions`
  flag, should each have been their own task.

## Suggested next task
- 043 step 1: the Amazon, Google and Flipkart sample, under a tight spend cap, exported for
  your review. Composing one real report at the same time would check the new
  better-answer notes.

## Open questions for you
- **043:** do you approve the sample run? It makes live Gemini calls and spends real money,
  though only a small amount under the cap. The full run of about ₹1,000 comes only after
  you have reviewed the sample.
- **The admin gate:** is it good enough to start spend through, or does it need a real role
  first?
