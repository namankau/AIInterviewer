# Task 030 — narrow what we offer, and build the room it deserves

Planned 9 September 2026, with the owner, from three screenshots of Layrs' interview
room. Prior research: `docs/competitor-layrs.md` (task 003).

## Why this task exists

The owner's argument, in their words: *"there is no good tool out there that handles
[behavioural and system design]. Most of them just theoretically teach sys design rather
than teach or interview it in interactive way."* And on coding: *"people have a lot of
sites where they usually practice and I don't think they would come to me directly."*

So: stop spreading across eight round types, and make the spoken, interactive rounds
genuinely good — starting with system design, which is the one with a real gap.

**The risk, stated once and then accepted.** Narrowing toward system design moves us
*toward* the Google/Amazon segment every competitor already serves, and away from the
TCS/Infosys/Deloitte coverage `CLAUDE.md` calls "the differentiator". The owner's counter
— that nobody interviews system design *interactively*, they only teach it — is a fair
answer, and the six offered rounds below keep the service-IT and consulting paths alive.

## Decisions taken (owner, 9 September)

| Question | Decision |
|---|---|
| Which rounds appear in the UI | Six of eight. All eight stay in the backend. |
| Interviewer identity | Named **Natasha**. Still visibly drawn, never implied human. |
| Canvas scope | Candidate draws. The model reads the board at phase boundaries only. |

---

## Part 1 — Offer six, understand eight

### The trap this avoids

`round_type` is a Postgres enum and `RoundType.fromDbValue` **throws** on an unknown
value. Deleting enum values would orphan existing sessions and make their reports throw
on open. Current data:

| round type | sessions |
|---|---|
| project_deep_dive | 9 |
| system_design | 7 |
| case_client_scenario | 1 |
| hr_fit_closing | 1 |
| coding_practical | 1 |

So nothing is deleted. What changes is what a candidate can *start*.

### Offered

`project_deep_dive`, `system_design`, `behavioural_competency`, `case_client_scenario`,
`hr_fit_closing`, `coding_practical`.

**Coding is offered as a spoken interview, not a practice tool.** No editor, no test
runner — that is what LeetCode is for and we will not win there. Its existing brief
already says the right thing: *"assess approach, edge cases and complexity awareness
rather than syntax, since the candidate is speaking rather than typing."*

### Not offered

`techno_managerial`, `technical_fundamentals`. Backend intact, history readable,
re-opening is a config change.

### Mechanism

A config property — `interviewos.rounds.offered` — not a code constant, following the
precedent set by `interviewos.entitlement.free-rounds` in `Entitlement.kt`: a product
decision that will be revisited should be one line in `application.yml`, not a rebuild.

Three gates, all of which must agree:

1. **`ai/schemas/compose-round.json`** — trim the `roundType` enum to the offered set, so
   the model cannot route someone's one-line query into a round they cannot start. This
   is the one that actually matters; the other two are presentation.
2. **`lib/rounds.ts`** (`ROUND_CATALOGUE`) — the candidate-facing catalogue.
3. **The setup form** — `new-interview-form.tsx`.

**Plus a server-side check.** The client is not trusted: `POST /sessions` must reject a
round type that is not offered, rather than relying on the form to have hidden it.

### Tests

- A retired round type still parses, still renders its report, still appears in history.
- Starting a retired round type is refused by the API, not merely hidden by the UI.
- The `compose-round` schema enum and the offered set cannot drift apart (assert one
  against the other, so adding a round to one and forgetting the other fails CI).

---

## Part 2 — Natasha, and the room

### Natasha

`CLAUDE.md` currently says the interviewer is *"drawn, not photoreal, and has no name"*.
Half of that is being reversed, deliberately.

**Kept:** drawn, not photoreal. The reasoning stands — *"a synthetic photoreal face gets
mistaken for a real person, and a candidate who believes there is a human here has been
lied to."* A photoreal talking head also commits real spend, which is owner-only.

**Reversed:** the no-name rule. A name on a visibly drawn figure does not claim
humanity; it gives the candidate someone to address, which is the thing a spoken round
needs. The room labels her as an AI interviewer, in as many words, and nothing in the
product implies otherwise.

`CLAUDE.md` is amended in the same commit as the change, with the reasoning above — not
after, and not silently.

### The room's density, reconciled

`CLAUDE.md` says the session screen is *"deliberately near-empty"* and forbids *"score
tickers, live hints, gamification"*. The reference room has a case panel, a phase rail, a
transcript and a canvas.

**Those are working surfaces, not feedback surfaces.** Not one of them is a score ticker,
a live hint, or a gamification element. The reference's own copy — *"no coaching while
the clock is running"*, *"feedback comes at the debrief, not during"* — agrees with our
rule rather than breaking it. A system design round without somewhere to see the problem
statement and somewhere to draw is not a calm interface; it is an unusable one.

So the prohibition stands verbatim and the "near-empty" phrasing is amended to say what
it always meant: nothing on this screen tells the candidate how they are doing.

### What the room gains

| Surface | Source | Notes |
|---|---|---|
| Phase rail | `InterviewPlan` already tracks phase and `minutesRemaining` | System design: Requirements → High-level → Deep dive → Wrap |
| Case panel | **New** — needs structured case data | The problem, plus its scale constraints |
| Live transcript | Already built (`use-live-transcript.ts`) | Already a mirror; already never scored |
| Canvas | **New** | See below |

The case panel needs the opening question for a system design round to carry more than
prose: a title, and the two or three constraints that define the problem ("500M
txns/day", "100–300ms SLA"). That is a new field on the opening-question schema, and it
is subject to the existing rule — **never fabricate employer-specific detail.** A case
attributed to a named employer must come from the archetype, and say so.

### Canvas, v1

**Candidate draws. The interviewer reads the board at phase boundaries only.**

- The board is stored as a compact scene (shapes, labels, edges), not a bitmap, so it can
  be diffed, replayed into the report, and rendered server-side.
- The model sees it **at each phase transition — about four times a round — not per
  turn.** A board on every turn is roughly thirty image payloads per round; at phase
  boundaries it is four. That is the entire reason for the boundary rule, and the ledger
  (`ai_calls`) will show whether it held.
- The board is evidence in the report, and falls under the same rule as everything else:
  the model may describe what is *on* it and may not invent what is not.
- The board is personal data. It gets the same 28-day expiry and the same deletion purge
  as the audio (`RoundDeletion.kt`), or it is a retention hole.

---

## Sequencing

Smallest first, so a usable system design round exists before the canvas is finished.

1. **Round narrowing** — config, three gates, server check, tests. Small.
2. **Natasha + the `CLAUDE.md` amendment.** Small.
3. **Room shell** — phase rail and case panel. Needs the opening-question schema change.
4. **Canvas v1** — candidate draws, board read at phase boundaries. Largest; its own task.

## Deliberately not in this task

- **A report paywall.** The reference's pre-flight says *"the written review is a Pro
  feature"*. `CLAUDE.md`: whatever the free tier ends up being, *"it must include the full
  report, because the report is what sells the product"*, and payments are owner-only.
  Flagged, not implemented.
- **Loops.** Screenshot 1 offers *"make it a full loop?"* — several rounds against one
  company with an onsite date and a readiness score. `CLAUDE.md` forbids exactly this
  shape: *"Interview context is chosen per session, not stored as a persistent target
  list… Do not build a 'my targets' entity."* Adopting loops reverses an architectural
  rule that exists to keep the mobile port cheap. It needs its own decision, on its own,
  not smuggled in with a round list.

## Open question for the owner

The coding round's shape. The owner offered: *"if needed i can show you how that is done
on layrs."* Worth taking up before building it — a spoken coding round with no editor is
an unusual thing and it is easier to match a working example than to guess at one.
