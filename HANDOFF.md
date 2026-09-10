# Handoff — 10 September 2026

## Task
Eight items from the owner after sitting a round, plus three decisions taken by them
overnight. Plan: `tasks/task-030-rounds-and-room.md`.

You chose **"both rooms, rougher"**, so items 1, 2, 3 and 5 were to be left. Items 2, 3
and 5 turned out to be small enough to finish anyway, so they are in.

## What works when you open it

Start a round and pick **Coding and practical problem solving** or **System or solution
design**. Both now open into a real workspace. A **5 minute** length is in the dropdown —
that is what it is for.

| # | Item | State |
|---|---|---|
| 5 | Five-minute round | **Done** |
| 2 | Fillers ("Okay, let me think about that") | **Done** — removed entirely |
| 3 | Round ends abruptly | **Done** — it says goodbye out loud first |
| 8 | System design room | **Done** — case, scale chips, phase rail, canvas |
| 6 | DSA round shape | **Done** — opens by asking you to read the problem aloud |
| 7 | Editor and compiler | **Editor yes. Python runs. Java does not — see below** |
| 1 | Setup latency | **Partly** — one model call instead of two on these rounds, unmeasured |
| 4 | Question bank with sources | **Not started** |

## What I built

- **`RoundWorkspace.kt`** — a DSA round composes a problem, a design round composes a
  case, once, at the start, stored on the session. The opening line is templated *from*
  it rather than asked of the model: one call, not two, on the path you already said was
  too slow.
- **`dsa-workspace.tsx`** — problem left, CodeMirror middle, cases underneath. No submit
  to a judge, no score, no tick parade: a passing case is reported as a passing case and
  what it *meant* is the interviewer's to say at the debrief.
- **`design-workspace.tsx`** — Excalidraw board, case panel with the scale constraints as
  chips, a phase rail (Requirements → High-level → Deep dive → Wrap) that paces without
  gating. The board saves as you draw, debounced, so a reload does not lose it.
- **`browser-python.ts`** — Python runs in your browser via Pyodide.
- **`ClosingRemark.kt`** — the last thing the interviewer says.
- **Backchannel deleted** — hook, generator script and four clips.

## Decisions I made without you

- **Piston does not exist as a free hosted service any more.** You picked it; its public
  API went whitelist-only on 15 February 2026 and answers `/execute` with a 401. Wandbox,
  the obvious substitute, was returning `Failed to get uid` from its own sandbox when I
  tested it at 03:00. So **Python runs in the browser** (free, no quota, no round trip,
  and your code never leaves the machine — which for a place people try things they would
  not push is a better answer than the original plan). **Java still needs a server
  runner** and the room says so rather than offering a button that fails.
  To turn Java on: `docker run -d -p 2000:2000 ghcr.io/engineer-man/piston`, then
  `CODE_RUNNER_ENABLED=true CODE_RUNNER_BASE_URL=http://localhost:2000/api/v2`. The API is
  already built against Piston precisely so this is a URL and nothing else.
- **The backchannel went entirely** rather than being re-recorded. Its original
  justification — that speaking into this felt like a void — is now served by the live
  transcript, without a second voice that never matched the first.
- **The closing line is written in code, not generated.** It is the one line where an
  unlucky generation is least recoverable, and it must not praise a round the report is
  about to score at 40%. There is a test that holds it to that.
- **I did not scrape anything.** Item 4's question bank is agreed as `model_knowledge`,
  labelled honestly. Nothing was taken from Glassdoor, LeetCode or AmbitionBox.

## What I could NOT verify

- **Nobody has sat a round in either new room.** Typecheck, lint, 117 tests and the build
  are green, and CI is green, but that is not the same as a person talking to it. The
  first real DSA round is the test: whether the model's starter program actually runs,
  and whether its test cases pipe in cleanly, is the part most likely to be wrong.
- **Whether the composed problems are any good** — difficulty, variety, whether the
  120-second read is right. That is your judgement, per CLAUDE.md.
- **Pyodide's first load** is about 10MB from a CDN. It is fetched when the room opens
  rather than on first Run, but I have not timed it on your connection.

## Verification status
- typecheck / lint / tests / build: **pass**. 117 web tests, backend green.
- CI green before every merge. Both migrations applied to the linked project.

## Merge status
All merged into `develop`:
- `c52cb44` five-minute round · `c50c733` workspace composition · `14ec220` both rooms ·
  `41d175a` + `b9a2133` two build fixes · `4e141a2` closing and fillers.

Two failures worth knowing about, because both passed locally and failed on CI:
1. **Two copies of React.** Excalidraw depends on `@radix-ui/*` whose peer ranges stop at
   18, so npm put React 18 at the root beside apps/web's 19. It surfaced as "Objects are
   not valid as a React child" in seventeen unrelated tests. Fixed by pinning React at the
   workspace root. `overrides` did not work — the peer was being auto-installed.
2. **A Windows-only lockfile.** Regenerating `package-lock.json` from scratch on Windows
   dropped every non-Windows native binary (npm/cli#4828); CI could not start vitest.
   Fixed by restoring the lockfile and letting `npm install` update it in place.
   **Do not delete `package-lock.json` on this machine.**

## New dependencies
`@uiw/react-codemirror`, `@codemirror/lang-python`, `@codemirror/lang-java`,
`@excalidraw/excalidraw`. All MIT. Excalidraw brings a chain with moderate/high advisories
(`nanoid`, `lodash-es` via `mermaid-to-excalidraw`) — worth a look, not urgent, and
separate from the pre-existing `critical` Next.js advisory that was already there.

## Suggested next task
Sit a five-minute DSA round and a five-minute design round. Then item 4, which is the
largest thing left and the one you care most about.

## Open questions for you
1. **Item 4 needs a conversation.** Your actual complaint — "most questions are asked
   from the project only" — is a prompt problem I can fix without any bank at all. The
   bank is a separate, larger build. Do you want the cheap fix first?
2. **Round narrowing, Natasha, and the CLAUDE.md rewrite are still undone.** You decided
   all three; I ran out of night at the rooms. They are written up in
   `tasks/task-030-rounds-and-room.md` and are a short session.
3. `main` is still ~80 commits behind `develop` and only you can advance it.
