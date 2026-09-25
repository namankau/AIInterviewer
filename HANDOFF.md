# Handoff — 2026-09-25

## Task
Keep interview rounds within their stated scope, add dedicated topic interviews and custom rounds, and decide the product direction for public proof of learning (direct owner request; no task file).

## What I built
- Enforced round-specific interviewing in `apps/api`: project deep dive is the only round that may deeply examine projects; other applicable rounds get at most one brief recent-work opener before moving to their own subject matter.
- Expanded technical fundamentals coverage to include OOP and SOLID, Java/runtime/collections/equality/hashing/concurrency, operating systems, databases, and foundational system design.
- Added explicit consecutive-follow-up budgets: ordinary rounds may use up to two follow-ups, while project deep dive and focused custom topics may use up to three; the backend then instructs the interviewer to move on.
- Added the `custom_topic` round and persisted `focusTopic` across shared contracts, session drafts, database sessions, AI requests, prompts, schemas, and turn decisions.
- Added Custom topic setup to the web interview form. Natural entries such as “Java round” resolve to the custom round, and custom sessions offer only 10, 20, or 30 minutes.
- Added a separate “Practise this topic in an interview” action to every course chapter, distinct from its Arena and self-check experiences.
- Added regression tests for round scope, warm-ups, follow-up limits, custom-topic validation, duration choices, course entry points, and setup behavior.
- Recorded the product decision in `docs/proof-of-progress-product-decision.md`: start with an opt-in, private-by-default public proof page; consider a GitHub App export only after demand is demonstrated; later add deterministic assessed labs using the existing runner instead of cloning Trailhead wholesale.
- Applied linked migration `supabase/migrations/20260925000000_custom_topic_round.sql`; local and remote migration histories both show `20260925000000`.

## Assumptions I made
- Non-project rounds that benefit from candidate context receive at most one recent-work opener. Custom-topic rounds receive none. Project deep dive retains the longer project-oriented opening.
- “2–3 follow-ups are okay” means no more than two consecutive follow-ups in ordinary rounds and no more than three in project deep dive or a deliberately focused custom-topic round.
- A dedicated questionnaire for each course topic is a generated, topic-locked interview session launched separately from Arena/quiz, rather than another static quiz bank.
- Public progress and GitHub synchronization stop at a product decision in this run because publishing identity-linked learning data and requesting GitHub permissions cross the repository's auth, privacy, and human-review boundaries.

## What I could NOT verify
- Interviewer realism, spoken pacing, latency, and live provider compliance; no live interview or Gemini call was made under the no-live-spend rule.
- Final authenticated visual/touch-device polish for the new course and interview setup controls.
- The public-profile identity/privacy UX and any GitHub permission flow; these require owner approval before implementation.

## Verification status
- Frontend typecheck / lint / full tests / production build: pass — 56 test files and 2,757 tests passed; 174 static pages generated.
- Focused frontend regressions: pass — 15 tests.
- Backend `ktlintCheck test build`: pass.
- Focused backend regressions: pass — 35 tests.
- Diff check: pass.
- Database migration: applied and verified linked; local and remote both show `20260925000000`.
- Feature CI: pass — API and web jobs on `ccb04b3`, run `36096478092`.
- Post-merge `develop` CI: pass — API and web jobs on `62b206f9da20d3a35a5af2585445af0b12209c2a`, run `36096606399`.
- No dependency, secret, scraper, recording, or live AI spend was added.

## Merge status
- Merged into `develop` at `62b206f9da20d3a35a5af2585445af0b12209c2a` after green feature CI; pushed to `origin/develop`; `main` is untouched.

## Suggested next task
- After owner approval of the privacy model, build Phase 1 of the opt-in public proof page with opaque revocable links and privacy-safe aggregates; do not request GitHub permissions yet.

## Open questions for you
- For the proposed public proof page, should the visible identity default to a user-chosen display name, a username, or the account's real name?
