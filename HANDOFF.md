# Handoff — 13 September 2026

## Task
"The Python executor still gives a different result than the expected test cases — is it
executing correctly, or pulling the right question/answer? Also the timer is not behaving
as expected." No task file; the evidence is from the last three coding rounds in the DB.

## What was actually wrong

**The runner was right. The expected outputs were wrong.** The model wrote them by working
each case out in its head. Checked by running real solutions in Google's sandbox *and* in
the browser runner — identical output from both, case for case:

| Round | Case | Model's "expected" | Correct | Your code printed |
|---|---|---|---|---|
| Log Stream Batch Processor | 2 | **2** | 1 | **1** — your solution was correct |
| Log Stream Partitioning | worked example 1 | **3** ("`[2, 5]`, length 3") | 2 | 3 |

The second one is worse: a wrong *worked example* is read first, and returning the span
instead of the count is exactly what "`[2, 5]`, length 3" teaches.

**The clock had four separate faults**, all visible in the same rounds:
1. It started when the session row was written — before the problem was composed and before
   the device check — so a five-minute round opened on well under five minutes.
2. Reaching 0:00 did nothing. One five-minute round ran to **7:17**.
3. The interviewer was told whole minutes rounded the wrong way: at 3:53 into a five-minute
   round it said "about two minutes left" while the clock said 1:07.
4. A DSA round labelled the whole problem-solving turn **"Warm-up"**, and planned the next
   turn as a warm-up beat whose instruction is "ask them about a project".

Plus one that made the clock look erratic: in a DSA room, **3.5s of silence ended your
answer** — typing is silent — and the interviewer cut in with "let me stop you there".

## What I built
- **`ProblemVerifier.kt`** (new) — the model now also writes a reference solution and a
  brute force (`compose-problem.md/.json`). Both run on every test input in Gemini's
  code-execution sandbox (`GeminiInterviewAi.runPython`, new `CODE_EXECUTION` capability).
  A case keeps the answer the two agree on; disagreement drops the case; worked examples are
  rebuilt from verified cases, keeping an explanation only if it argued for the right
  answer. The program prints SHA-256 hashes of what it ran, and a report that does not match
  what we sent is not believed. The solutions are stripped before the problem is stored —
  they never reach the browser.
- **`RoundWorkspace.kt`** — composes once more if the model's two solutions disagree.
- **`dsa-workspace.tsx`** — says plainly when a problem's tests could not be checked.
- **`browser-python.ts`** — stdin now supports `sys.stdin.buffer`; comparison ignores line
  endings and trailing spaces (same rule as the server), nothing looser.
- **`POST /sessions/{id}/begin`** + `SessionRepository.startClock` — the clock starts when
  you enter the room. Idempotent (`started_at = created_at` marks "not started"), so a
  reload never buys time. **No migration.**
- **`round-clock.tsx`** (extracted) — fires once at 0:00; the room then submits the answer in
  progress as the last one and the interviewer says time is up.
- **`InterviewPlan.kt`** — seconds, not minutes; an answer in the last 30s ends the round;
  no warm-up in rounds with a workspace. `PromptLibrary` says "about a minute" / "less than a
  minute", never "0 minutes".
- **`interview-room.tsx`** — in DSA/design rooms silence no longer ends a turn; an
  **"Over to you"** button hands over, and one unbroken take is capped at 10 minutes.

## Measured
- Live, real prompt + real Kotlin harness + real sandbox: 3 of 3 fresh problems verified,
  4/4 cases each. Compose 3.9–6.0s, **verification 3.4–4.2s** added to DSA setup.
- Your broken Batch Processor problem through the live verifier: case 2 corrected 2 → 1,
  both misleading explanations dropped.
- Cost of verification: ~3.5k input + ~1k output tokens on flash-lite ≈ **₹0.20 per DSA round**.
  The ledger now counts `toolUsePromptTokenCount`, which Gemini reports outside the prompt count.
- Browser runner re-verified in headless Chromium: infinite loop stopped at 6.0s with the
  page ticking 60/60, restart, fresh namespace, `sys.stdin.buffer`, `input()`.

## Assumptions I made
- "Timer not behaving" meant all of the above; I fixed every clock fault the data showed
  rather than guess which one you saw.
- The "Over to you" button breaks the room's no-buttons rule, deliberately and only in the
  DSA and design rooms: silence cannot mean "I'm done" when the work is silent.
- When the brute force times out, the model's own figure is accepted as the second opinion
  only on an exact match with the reference.

## What I could NOT verify
- **Nobody has sat a round with these changes.** In particular the time-up flow (submit
  at 0:00 → "That's us out of time"), and whether "Over to you" feels right.
- Whether flash-lite transcribes a long, mostly-silent coding take faithfully.
- Problem variety: 2 of 3 live runs produced the same problem for the same brief. Existing
  behaviour, not new, but you will notice it.

## Verification status
- typecheck / lint / tests / build: **pass** — 123 web tests; API ktlint + tests + build green
  (16 new API tests: verifier, composer, begin endpoint, plan).

## Merge status
- See the end of this run: merged into `develop` once CI is green, or left on
  `fix/verified-tests-and-round-clock` if it is not.

## Suggested next task
Sit a five-minute DSA round: Run should now match on a correct solution, the clock should
open on 5:00, and at 0:00 the round should end on its own.

## Open questions for you
- None blocking. Java still needs a server runner (see the previous handoff's Piston note).
