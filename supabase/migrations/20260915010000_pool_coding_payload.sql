-- Round-type-specific detail on a pool question (PRD §08). Task 040.
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- Additive only: one nullable jsonb column on `pool_questions`, no backfill.
--
-- WHY A COLUMN, NOT A SECOND TABLE
--
-- Every pool question already carries the columns every round type needs: `text`,
-- `follow_ups`, `strong_answer_covers`, `association`. What task 040 adds is detail that
-- only two round types have -- a coding problem's starters and verified tests, a system
-- design case's constraints and which flavour of design it is -- and that detail describes
-- one question, not a separate thing with its own lifecycle. A parallel table keyed on
-- `pool_questions.id` would need the same row-level security posture, the same retire
-- semantics, and a join everywhere this is read, for no benefit over a column that is
-- simply null when a round type has nothing to put in it.
--
-- SHAPE
--
-- `payload` is null for every round type except `coding_practical` and `system_design`
-- (task 040) and whatever tasks 041 adds that later decides it needs one. Each generator
-- writes its own Kotlin data class (see `com.interviewos.api.pool.CodingPoolPayload` and
-- `com.interviewos.api.pool.SystemDesignPoolPayload`) rather than a loose map, so the shape
-- below is enforced in code, not only documented here.
--
-- coding_practical (CodingPoolPayload):
--   {
--     "kind": "coding_practical",
--     "topic": string,                 -- the technique: "monotonic stack", "binary search on the answer"
--     "difficulty": "easy" | "medium" | "hard",
--     "statement": string,             -- the problem, in our own words -- never a copied statement
--     "examples": [ { "input": string, "output": string, "explanation": string | null } ],
--     "constraints": [ string ],
--     "starterPython": string,         -- a complete runnable program with a stub the candidate fills in
--     "starterJava": string,
--     "stdinFormat": string,
--     "testCases": [ { "input": string, "expected": string } ],
--     "testsVerified": true            -- always true on a stored row; ProblemVerifier checked it before
--                                       -- CodingQuestionGenerator wrote anything, and a problem whose two
--                                       -- solutions do not agree is never written at all
--   }
--
--   Deliberately holds no reference or brute-force solution: those exist only to check
--   `testCases` and are discarded once that is done, the same discipline `ComposedProblem`
--   itself uses before a problem reaches a candidate's browser.
--
-- system_design (SystemDesignPoolPayload):
--   {
--     "kind": "system_design",
--     "designTag": "machine_coding" | "distributed_design",
--     "title": string,
--     "summary": string,               -- the tension that makes the case hard
--     "constraints": [ string ],       -- the scale/latency numbers that force it
--     "weakAnswerMisses": [ string ]   -- what a weak answer leaves out
--   }
--
--   `text` on the row is the case's opening prompt (what is said aloud to start) and
--   `follow_ups` is the case's own deep-dive options -- both already fit the shared columns,
--   so neither is repeated here. `designTag` is what tags LLD / machine-coding within this
--   one round type rather than adding a second `round_type` value or a new column that
--   would sit null for every round type except this one: entry/mid cells get
--   `machine_coding`, senior/staff cells get `distributed_design` (task 040).

alter table public.pool_questions
  add column if not exists payload jsonb;

comment on column public.pool_questions.payload is
  'Round-type-specific detail beyond the shared columns -- a coding problem''s starters and '
  'verified tests, a system-design case''s constraints and its machine-coding/distributed '
  'tag. Null for round types with nothing beyond the question itself. Shape documented at '
  'the top of 20260915010000_pool_coding_payload.sql and mirrored in Kotlin as '
  'CodingPoolPayload and SystemDesignPoolPayload (com.interviewos.api.pool).';
