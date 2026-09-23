# Task 056 — cut the latency that is actually measurable

The owner reports "a lot of latency in certain operations". A real `next build` on 22 Sep
found three defects with numbers attached. Fix them. Do not go hunting for a fourth; if you
find one, write it in HANDOFF rather than fixing it here.

Every fix below must be demonstrated with a before/after number, not asserted.

## L2 — `/dashboard` ships 744 KB of course prose to the browser

`.next/static/chunks/36wqw2t1io6fx.js` is 744 KB, loaded by `/dashboard` and by no other
route. It contains every chapter of both courses — `grep -c StringBuilder` on it returns 57.

Cause: `components/continue-learning.tsx` is a `"use client"` component that imports
`{ courses } from "@/content/courses"`. It needs, per course, only the slug, the title, and
each chapter's slug and title. It is pulling in every code sample, every `viz` frame and
every quiz to do it.

Fix it so the dashboard no longer ships chapter bodies. The shape that fits this codebase is
a slim outline derived in a server context and either passed as props or exported from a
module that carries no block content. Whatever you pick, the constraint is that adding a new
course must not require remembering to update a second list — derive the outline from
`courses`, do not hand-maintain it.

**Guard it.** Add a test that fails if a client component ever imports the course content
barrel again, or the regression walks straight back in on the next feature.

## L3 — `/arena` prerenders 892 KB of HTML

`.next/server/app/arena.html` is 892 KB and `arena.rsc` is 820 KB. `app/arena/page.tsx`
passes `allChallenges={allArenaChallenges}` — all ~800 derived challenges, `Viz` objects and
all their frames included — into a client component. `app/arena/[course]/page.tsx` does the
same with `allCourseChallenges={challenges}`.

The daily quest needs 7 of them. The reason the whole corpus crosses the boundary is that
"today" must be the *visitor's* local date, not the server's, so the server cannot pick.

Note that the server *can* narrow it to the handful of dates any visitor on earth could
currently call "today" (UTC−12 to UTC+14 spans at most three calendar dates), and send only
those quests. That is one honest option; fetching challenges on demand from a route handler
is another. Pick one, say in the PR why, and keep `dailyQuest` deterministic and its existing
tests passing. `/arena/[course]` has the same problem and does not have the timezone excuse.

**Guard it.** A test that asserts an upper bound on the number of challenges crossing into
the client on each Arena page.

## L4 — a Postgres connection is held open across every Gemini call

`InterviewService.submitAnswer` (`apps/api/.../interview/InterviewService.kt:424`) is
annotated `@Transactional`, and inside it calls `interviewAi.assessAnswer`, which takes
seconds. The transaction — and the pooled connection under it — is held for the whole model
call. `requestHint` has the same shape.

The fix is already written in the same file: `inTransaction` exists precisely so a method can
"open and close transactions *inside* one method — around the database writes and not around
the model call between them", and `startSession` already uses it. Apply that pattern to
`submitAnswer` and `requestHint`.

Be careful, this is the part to get right: dropping `@Transactional` changes atomicity, not
just timing. Work out what genuinely has to commit together — the answer record, the next
turn insert, the status change — and keep those inside one short transaction each. The
existing read-check-then-write guards against double submission (`turn.answeredAt != null`,
`already_answered`) must still hold. If a half-written turn becomes possible under any
interleaving you can construct, say so and stop rather than shipping it.

Add a test that fails if the model call happens while a transaction is active.

## Scope
- Branch from `origin/develop` as `perf/payload-and-transactions`.
- No new dependencies.
- Do not touch `lib/supabase/session.ts` — the proxy's auth call is being fixed separately.
- Full verification loop both sides, per CLAUDE.md. Push the branch and stop; do not merge.
