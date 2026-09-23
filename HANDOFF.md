# Handoff — 2026-09-23 (run started 22 Sep)

## Task
Two things you asked for in one session: cut the latency you were feeling, and add an AI /
Agentic AI course with somewhere to actually build an agent.
`tasks/task-056-latency-hot-paths.md`, `tasks/task-057-ai-and-agentic-ai-course.md`.

---

## Part 1 — latency

You said "a lot of latency in certain operations" without naming them, so I measured rather
than guessed: a real `next build`, then the built output on disk. Four defects had numbers
attached. **Every fix has a before/after and a guard test**, so none of them can quietly
come back.

| | Before | After |
|---|---|---|
| `/dashboard` client JS | **744 KB chunk** carrying all 65 chapters of prose | gone; no chunk contains chapter content |
| `/arena` HTML | 910,874 bytes | **38,126** (and that is now with *three* courses) |
| `/arena/dsa` | 547,244 | 46,470 |
| `/arena/java` | 445,855 | 48,892 |
| Gemini call | held a pooled Postgres connection open for its whole duration | outside the transaction entirely |
| Proxy, every navigation | network round trip to Supabase auth | local signature verification (**PR #14**, see below) |

**What was actually wrong, in one line each:**

- **The dashboard** was shipping every code sample, quiz and diagram frame in both courses to
  the browser — to draw a "Continue learning" card that needs slugs and titles.
  `continue-learning.tsx` was a client component importing the content barrel.
- **The Arena** serialised its entire ~800-challenge corpus, `Viz` frames included, into the
  page as props. The daily quest genuinely cannot be chosen server-side, because "today" has
  to be the visitor's own calendar day — but the server *can* narrow it to the at most three
  dates anyone on earth could currently call today, and send only those.
- **`submitAnswer` and `requestHint`** were `@Transactional` around the model call. The fix
  was already written in that file: `inTransaction` exists so a method can bracket its writes
  without bracketing the several-second model call between them.
- **The proxy** called `supabase.auth.getUser()` on every request — a round trip to Supabase's
  auth server on every navigation, and, because Next prefetches links entering the viewport,
  on every prefetch too. The courses index alone has 65 links on it.

**The guards:** a test that fails if any client component imports the course barrel again; a
test capping how many challenges may cross into the client; a test that fails if the model
call is ever put back inside a transaction. The last one was verified by putting the call
back and watching it fail, then reverting.

## Part 2 — the AI and Agentic AI course

`/courses/ai-agents` — **33 chapters in six modules**, written to the bar the other two
courses are held to.

- **99 quizzes** (three per chapter), 33 everyday analogies, 33 runnable Python playgrounds,
  and the pitfall / remember / interview boxes each chapter carries.
- **Every analogy names the point where it stops being true.** An unbounded analogy is just
  the next misconception.
- **Grounded in the primary sources and cited in the prose**, per your "don't reinvent the
  wheel" instruction — ReAct (arXiv:2210.03629), chain-of-thought (2201.11903), RAG
  (2005.11401), the transformer paper (1706.03762), Anthropic's *Building Effective Agents*
  for the workflow patterns, and the Model Context Protocol specification itself rather than
  a blog summary of it.
- The Arena picked the course up for free — `/arena/ai-agents` exists without anything being
  authored twice, because challenges derive from the content.

**The agent lab** is the interactive part you asked for. The learner picks a goal, writes the
system prompt, chooses tools, sets a step limit, and steps through the thought / action /
observation trace a frame at a time. It appears in four chapters and teaches by letting them
break it: a vague tool description producing a wrong call, a loop with no stopping condition,
an agent that cannot see its own observations.

---

## Assumptions I made

- **The agent lab is a deterministic local simulation, and the UI says so in as many words**
  ("Simulation — no model is called"). Rule 7 forbids live spend without you, and a lab that
  let a reader believe a scripted trace came from a real model would be the same failure as a
  report describing eye contact nothing watched. **It is built so wiring a real model in later
  is a runtime swap, not a rewrite** — but that commits real spend, so it is yours to decide.
- Code in this course is **Python, not Java** — that is what the field is written in, and the
  playground genuinely runs Python in the browser.
- **The landing page, `/courses` and `/arena` stopped saying "Java and DSA"** and their card
  grids went to three columns. Three cards in a four-column grid leaves a hole.
- `perf/auth-claims-in-proxy` went to a **PR rather than a merge** because it touches auth
  (rule 1). The other two branches merged on green CI.

## What I could NOT verify

- **Nothing has been looked at in a browser.** This is the fourth run in a row where that is
  the main gap. Please look at: `/courses/ai-agents`, the agent lab in chapters 12, 13, 14
  and 15 (does stepping through a trace actually teach the loop, or is it a toy?), the
  three-card grids on `/` and `/courses`, and `/arena/ai-agents`.
- **Nobody has taken the course.** Whether 33 chapters reads as approachable to a class-12
  student or as a wall is exactly the judgement CI cannot make.
- **PR #14's benefit depends on something only you can check.** `getClaims()` only avoids the
  network round trip if your Supabase project signs JWTs with **asymmetric keys**. On the
  legacy shared secret it falls back to asking the server, exactly as before — no regression,
  no gain. Switching signing keys is a dashboard action.
- **No latency was timed against anything live.** Every number above is structural — bytes on
  disk, transaction-open state — not a stopwatch against a real model or a real Supabase
  project. Rule 7.
- Whether `/arena/[course]`'s new on-demand fetch shows a visible loading flash worth
  polishing.

## Verification status
- typecheck / lint / tests / build: **pass**, both apps, on the merged result.
  1,974 web tests pass; `./gradlew ktlintCheck test build` green.
- CI verified **against the exact branch tip each time**, not "the latest green run" —
  `f3cd4482` for the perf branch, `398d16e6` for the course branch.
- Migrations checked with `migration list --linked` before merging: every local row has a
  matching `remote`, and **neither branch adds a migration**. Nothing to `db:push`.
- **No new dependencies** in either piece of work.

## Merge status
- **`develop` at `0d508ea`** — both the latency work (`95dfb0c`) and the course (`0d508ea`).
- **PR #14** (`perf/auth-claims-in-proxy` → `develop`) open, CI green, awaiting you because it
  touches auth.
- Nothing pushed to `main`. PR #9 (`develop` → `main`) is still open and now understates the
  release by a full course and a latency pass.
- The course merge is ~12,000 lines. That is far over the ~800-line guideline, and it is a
  course, so I am recording it rather than pretending it is reviewable in one sitting — it
  went in as seven commits, one per module, which is how to read it.

## Found, not fixed — worth its own task
`SessionRepository.recordAnswer`'s UPDATE has **no `WHERE answered_at IS NULL` guard**. It is
an unconditional overwrite keyed on `(session_id, user_id, turn_index)`. So protection against
two concurrent submits for the same turn has never been a database-level guarantee — before
or after this run — and rests on an application-level read-then-write plus the client not
double-submitting. The comments in that file imply a stronger guard than exists.

Separately: `block-renderer.test.tsx` flakes under full-suite load on this machine (a
`findByText` racing the lazy playground import). It passes in isolation and on CI. Its timeout
should be raised before it wastes somebody's afternoon.

## Suggested next task
Open `/courses/ai-agents` and play the agent lab. If the lab works, the obvious follow-up is
whether it should call a real model — which is a spend decision, so it is yours.

## Open questions for you
- **Should the agent lab ever call a real model?** It is built for it. It costs money per run
  and would need rate limiting and an abuse story, so I did not.
- Still open from earlier runs: the Java runner (self-hosted Piston — spend plus an
  arbitrary-code-execution surface), one live generation run for the aptitude generator (it
  has still never produced a real question), and account sync / leaderboard for the Arena.
