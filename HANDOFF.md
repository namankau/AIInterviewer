# Handoff — 2026-09-21

## Task
Make the courses stop being pure theory (visuals + somewhere to try things out), and make
mock interviews much better for freshers facing campus placements — reusing open source
rather than reinventing it. Tasks `tasks/task-047` through `tasks/task-051`.

## What I built

**Courses — visuals (task 047, merged `1c08197`)**
- `apps/web/src/content/courses/types.ts` — a `viz` block kind with a declarative union:
  `array | list | stack | queue | tree | graph | table | callstack`. Content describes state
  per frame, never SVG coordinates. Every frame carries a `note` — that is what makes it
  teaching rather than decoration.
- `apps/web/src/components/courses/viz/*.tsx` — hand-rolled inline SVG per shape;
  `viz-block.tsx` adds previous/next/play/reset and a step slider.
- `apps/web/src/lib/courses/viz-layout.ts` — unit-tested binary-tree and radial-graph layout.
- **16 chapters converted** (12 DSA, 4 Java). Where a `trace` block existed it was *replaced*
  by the picture it was describing.
- Frame 0 server-renders, so the diagram is in the HTML for search and for JS-off readers.
  Colour is never the only signal — every state carries a text label too.

**Courses — try it yourself (task 049, merged `4893a2c`)**
- `playground` block kind, deliberately separate from `code` so a read-only sample can never
  pull in the editor bundle.
- `apps/web/src/lib/course-code-runner.ts` — the pluggable runner seam. `getRunner("python")`
  wraps the existing Pyodide worker; `getRunner("java")` is `null`.
- `apps/web/src/components/courses/playground.tsx` — CodeMirror, Reset, Run, distinct
  stdout/stderr, explicit timeout message. For Java: an honest line saying browser execution
  is not available yet. No fake Run, no unexplained disabled control.
- `apps/web/src/lib/highlight-code.ts` — Shiki at build time, dual light/dark, degrades to a
  plain `<pre>` on any error.
- 5 DSA chapters got a Python playground as proof; all 5 outputs were produced by running the
  code, not predicted.

**Interviews — freshers and campus placement (task 048, merged `fbdd27f`)**
- `CandidateStage.kt` — derives campus-fresher status server-side, deliberately narrower than
  `Level.ENTRY` (someone 18 months into a first job is ENTRY and not campus).
- A `levelCalibration` brief threaded through `opening-question.md`, `assess-answer.md`,
  `offer-hint.md`, `compose-problem.md`, `compose-case.md` and `report.md`. It says in words:
  judge against what a final-year student can know; do not ask what happened when it broke in
  production, about on-call, or about a team they led.
- `CampusRounds` — replaces, not appends to, the round ground for the five round types whose
  professional version is unanswerable by a student.
- System design is refused for a campus fresher, before any row is written or model called —
  and refused loudly rather than silently swapped when they chose it explicitly. Configurable
  via `interviewos.rounds.not-for-campus-freshers`.
- `RoundType.APTITUDE` + `AptitudeQuestionGenerator.kt` — spoken reasoning, not a timed MCQ.
- `ReportService` scores against the bar the round actually ran at, and is instructive for a
  student: name the topic to study next.

**Interviews — let a candidate say so (task 051, merged `2315016`)**
- One optional field at session start: "Where are you in your career?" A stated answer beats
  the derivation; saying nothing runs the pre-051 path unedited.

**Courses — Python alongside Java (task 050, merged `a83c871`)**
- **All 30 DSA chapters** gain a Python equivalent on every code block. The Java course stays
  Java — it is a course *about* Java.
- `code-language-context.tsx` — one page-wide Java/Python choice, backed by
  `useSyncExternalStore` rather than a Context plus an effect. SSR always renders one
  language, so there is no hydration mismatch, and `localStorage` is reconciled through the
  store's snapshot rather than inside an effect's setState.
- Both languages are highlighted by Shiki at build time.
- **Every one of the 31 Python snippets was executed locally and its real output pasted** —
  the same bar `types.ts` already set for Java.
- Two divergences were kept honest rather than forced to match: `groupAnagrams` prints in a
  different order because Python dicts preserve insertion order and Java's `HashMap` does
  not; and the raw-memory-address half of the arrays chapter has no honest Python parallel,
  because CPython lists hold pointers rather than values.
- Idiomatic Python throughout — `enumerate`, tuple swap, `deque`, `heapq`, `Counter`,
  `defaultdict`, comprehensions — and the Java scaffolding Python does not need (manual heap
  `grow()`, a `swap()` helper, the checked-exception dance) was removed rather than
  transliterated.

## Assumptions I made
- **"Campus fresher" is derived, not declared, by default** — `Level.ENTRY` and under 12
  months of resume experience, or no resume with a title saying fresher/intern/graduate.
  Guessing "student" from an empty profile would be the same bug mirrored. Task 051 then
  added the optional field so a student can correct it.
- **Aptitude is a spoken, reason-aloud round, not a timed MCQ.** An aggregator can already
  give a student a timed multiple-choice test; talking through the set-up is what a
  voice-first product can uniquely do. No MCQ engine was built.
- **Refusing rather than substituting** an explicitly-chosen system-design round for a
  fresher. A silent swap would leave them practising something they did not pick.
- **The DSA course gets Python, the Java course stays Java** — the latter is a course *about*
  Java. C++ was considered and rejected: it needs a server runner, same as Java.
- Visualisation is hand-rolled SVG with **no new dependency** — the pre-approved `dagre`
  fallback went unused because hand-rolled layout was sufficient at course scale.

## What I could NOT verify
- **Nobody has looked at any of this rendered, in a browser.** CI green means it compiles and
  passes tests. The visuals, the playground panel, Shiki's colours in dark mode, mobile
  layout and the step-control feel are all unverified by eye. Worth a look at
  `/courses/dsa/sliding-window`, `/courses/dsa/tree-basics-and-traversals` and
  `/courses/dsa/graph-representation-bfs-dfs`.
- **Nobody has clicked Run.** The lazy-load contract is unit-tested (the interpreter is never
  fetched merely by rendering), but real Pyodide load time and Worker behaviour against the
  CDN build are untested in a real browser.
- **No live AI call was made anywhere** (rule 7). So nobody knows whether a fresher round
  actually *sounds* like one, whether the calibration block changes Gemini's questions, or
  whether the aptitude generator produces questions solvable aloud — **it has never produced
  a real question.** This is the single highest-value thing to spend on: one cheap generation
  run, reviewed by eye.
- Copy tone: whether "Prefer not to say" reads as a calibration aid or a demographic question.
- Play-through pacing (1.6s/1.4s per frame) is a guess, not measured against reading speed.
- Aptitude round length is set at 25 minutes — also a guess.

## Verification status
- typecheck / lint / tests / build: **pass**, verified on CI for every merged branch, with
  the run's `headSha` checked against the branch head each time rather than trusting the
  latest green run.
- Migrations: **both applied and confirmed remote**, each in the same step as its merge.
  - `20260920000000_aptitude_round.sql` — adds the `aptitude` enum value.
  - `20260921000000_stated_candidate_level.sql` — adds `sessions.stated_level`. This one is
    the `report_expired_at` shape: the column is *selected* on every session read, so an
    unapplied migration would have broken every session, not just the new feature. Applied
    locally before `develop` was pushed, so the remote never existed without it.

## Merge status
- **All five workstreams merged into `develop`:** `1c08197` (047), `fbdd27f` (048),
  `4893a2c` (049), `2315016` (051), `a83c871` (050). Handoff at `07cdac2`.
- Every merge was gated on a CI run whose `headSha` I checked against the branch head, not
  merely on the latest green run for the branch.
- **Process deviation, owned:** the task-051 file was committed straight to `develop`
  (`17ead13`) rather than via a branch. Docs-only and CI went green after, but rule 1 says
  branch-then-merge and I did not.
- Nothing was pushed to `main`, and no PR was opened — none of this touched auth, payments,
  data deletion or permissions.

## Interruptions during the run
Three agents were killed mid-task — two by the plan's usage limit, one by a network drop —
and **none lost work**, because every brief required pushing after each coherent step. Each
was resumed with `SendMessage` (keeping its context) rather than restarted cold, per
CLAUDE.md's restart protocol. `runs/2026-09-20-progress.md` carried the state across.

## New dependency
- **Shiki (MIT)**, build/server-time only, for static code highlighting. Verified absent from
  every client chunk the course route requires. Nothing else was added: the editor, the
  Python runtime and the whiteboard were all already in the repo.

## Suggested next task
- Spend a little on one live generation run to check the aptitude questions and the fresher
  calibration actually land — it is the only remaining way to know. After that, look at the
  rendered course pages with your own eyes; nothing in this run has been seen.

## Open questions for you
- **The DSA course now defaults to the Python tab, not Java.** The reasoning was that the
  audience is DSA-first students prepping in Python/C++, and that Python is the only
  language a reader can actually execute in the playground. It is a product call and easy to
  flip — say so if you disagree.
- **The Java runner.** Every route costs money or security sign-off: self-hosting Piston
  (MIT) needs a `privileged: true` Docker sidecar; Judge0 is GPLv3 with an unresolved
  API-use question; CheerpJ needs a commercial licence. Piston is the recommendation, but
  the spend and the arbitrary-code-execution surface are yours to approve.
- **Group discussion** is a real part of campus placement and is not built. It needs multiple
  simultaneous speakers — a different interaction model from the turn-based voice loop. It
  wants its own task, and possibly its own decision about whether it belongs at all.
- **No open corpus exists** for Indian campus placement, aptitude, or DSA problem statements
  that a commercial product may use. CSES and Project Euler are CC BY-NC-SA (NonCommercial);
  Codeforces forbids republishing. `docs/third-party-sources.md` records this. It means that
  content has to be generated, not ingested — which is why the aptitude generator matters.
