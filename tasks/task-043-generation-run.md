# Task 043 — The generation run

**On hold. This task needs the owner's go-ahead before any of it runs** — `CLAUDE.md`
rule 7: no live AI spend without the owner saying so in the session. It is done by the
orchestrating session with the shell, not by an agent (`CLAUDE.md`, agent routing:
plumbing is the orchestrator's).

Depends on 039 (tables, job, spend cap, export), 040 and 041 (generators), 042 (rounds use
the pool, and the label) — all merged into `develop`, CI green, migrations applied.

## Why it is a task and not a command

The run spends real money against a real key, and what it writes is what candidates will be
asked. Two things have to happen in order, and the second is the owner's call, not the
agent's.

## Step 1 — the sample

Three companies, one from each group the pool has to serve: **Amazon** (the model knows it
well — expect `company_specific`), **Google** (the same, different values and loop),
**Flipkart** (India, less published — expect a mix, and some `employer_kind`).

- All round types, all seven role families, all four levels, with a **small per-cell count**
  and a **tight spend cap** on the run — this is a sample, not a tenth of the full run.
- Export it with `GET /api/v1/admin/pool/runs/{id}/export` and hand the owner the file.
- Alongside it, report: what it cost (from `ai_calls`, per model, and whether anything fell
  back), how many questions were dropped as duplicates, how many `company_specific` claims
  were downgraded by the gate, and how many coding problems failed verification.

## Step 2 — the owner reviews

**Stop here.** Realism is the owner's judgement, not the agent's (`CLAUDE.md`, things that
need a human). What the owner is deciding:

- Do these read like questions a real interviewer at that company would ask?
- Is the `company_specific` / `employer_kind` split honest — particularly on Flipkart?
- Are the behavioural questions actually mapped to values that employer states, or invented?
- Are the coding problems in our own words, and are they good problems?
- Is the per-cell count right, or should the full run generate more or fewer?

## Step 3 — the full run

Only after the owner says yes, and only with the corrections the review produced.

- All 40 companies (task 039's list), all round types, role families and levels.
- Estimated **≈ ₹1,000**. Set the run's `spend_cap_micro_usd` from that figure with a small
  margin, and **do not raise the cap mid-run without asking** — a cap raised silently is the
  same as no cap.
- The job is resumable and rate-limited by design: if it pauses on the cap, or the session
  dies, it restarts from its pending cells. Do not start a second run to work around a
  stalled one.
- While it runs, watch `ai_calls.fell_back_from`. Non-null on most rows means the primary
  model is gone again and the run is costing several times what was estimated — stop it and
  fix the chain before continuing (this is what `20260909120000_ai_spend_ledger.sql` exists
  to catch).

## Afterwards

- Report actual spend against the estimate, coverage per company and round type, and the
  duplicate and downgrade rates.
- Spot-check the export again before anybody sits a round on it.
- Sitting a real round of each type is a separate go-ahead, and also the owner's.

## Done when

The sample is exported and reviewed, the owner has approved the full run, the full run has
finished within its cap, coverage is reported per company and round type, and `HANDOFF.md`
records actual spend against the estimate.
