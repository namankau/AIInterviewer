# Task 038 — The round asks the company's questions

PRD §06 (compose → retrieve → conduct), §08 (grounding discipline, provenance). Part of
the overnight run: read [`overnight-2026-09-14.md`](overnight-2026-09-14.md) first.
**Starts after task 035 is merged.**

## What the owner asked for

> In mock interview, only pull up questions that are tagged against that company question
> bank that we'd maintain, or the information our AI provider will provide at that point.

## Today, and what is wrong with it

`SourceGrounding.forRound` hands the model up to twelve sourced questions as reference,
"not a script", and the model writes every question itself. The consequence that matters:
**every turn in a grounded round is stamped `published_source` with the whole library's
citations** (`InterviewService.provenanceJson(…, sources)`) — including follow-ups the
model wrote about the candidate's own answer. On most turns that label is wrong. Fixing it
is part of this task.

## Build

### Selection — server-side, unit-tested

- Candidates: bank questions tagged to **exactly** this session's company (035's
  `CompanyDirectory` — name or alias; never an archetype sibling, a parent, a subsidiary or
  a region) with this round type.
- Exclude bank questions this candidate has been asked before (new
  `session_turns.bank_question_id`, migration `20260914010000_bank_rounds.sql`, additive).
  When every one has been asked, the least recently asked come back first.
- Rank by corroboration, then recency; choose at random among the top few, with a seeded
  `Random` injected for tests. The last handoff noted the same problem coming back for the
  same brief — variety matters.

### Asking them

- **Opening:** when a bank question is selected, the interviewer asks it. The model may
  introduce it and shape it for speech; it may not change what is asked. The engine checks
  the delivered question against the bank text (token containment or similar, with the
  threshold tested); if it drifted, the bank text is used, after the model's lead-in.
- **Later turns:** follow-ups stay adaptive — that is the product (PRD §02, layer 1). When
  the round moves to a new topic, the next unused bank question is offered to the model as
  the planned question (in the assess-answer prompt); the model says whether it asked it,
  and the engine checks that the same way.
- **DSA and design rounds:** the workspace composers (`compose-problem`, `compose-case`)
  are seeded with the selected bank question — the problem or case *is* that question,
  written out. `ProblemVerifier` still checks the tests.
- **Nothing in the bank for this company and round** → today's path: the AI provider
  writes the questions, tier `model_knowledge`, with its disclosure. Never another
  company's questions.

### Provenance per turn, decided by the engine

- A turn that asked a bank question: `published_source`; citations are **that question's**
  sources; `bank_question_id` stored.
- Everything else — follow-ups and model-written questions: `model_knowledge`, whatever the
  round's grounding.
- Replace the twelve-questions reference block with the planned question, so the model is
  not quietly asking other bank questions the engine cannot label.
- The candidate-facing grounding note (`candidateFacingNote`, the room, the report) says
  which it was: "Questions in this round come from N sourced reports for Amazon", or "We
  hold no sourced questions for X's <round> rounds; these are written from general patterns
  for <archetype>."

### Tests

Company isolation ("Google Cloud India" is not Google; an alias does match); exclusion of
questions already asked; ranking and variety; the drift check both ways; tier per turn; the
fallback when the bank is empty; workspace seeding. An endpoint-level test that a round
started with bank questions stores `bank_question_id` and the right tier.

## Not in this task

Building the bank (035). The pre-round brief (037). Embedding-based retrieval.

## Done when

CI is green on `feat/bank-driven-rounds`, and the final report follows the overnight rules
— including one live check, through a prompt harness against Gemini as earlier tasks did,
that a planned bank question is actually asked and that the drift check behaves.
