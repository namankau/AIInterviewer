# Task 051 — Let a candidate say they are a student or fresher

**Follows task 048**, which built all the fresher machinery. This task closes the one hole
that agent flagged in its own work.

## Why

Task 048 derives "campus fresher" server-side from the role title and the resume:
`Level.ENTRY` **and** under 12 months of experience, or no resume with a title saying
fresher / intern / graduate / trainee.

That is a good default and it must stay — guessing "student" from an empty profile would be
the same bug mirrored. But it leaves a real hole, and it is in exactly the audience this
work is for:

> A candidate who types a plain "Software Engineer" and has no resume, or a resume the
> parser reads thinly, still gets a mid-level round.

A final-year student practising for campus placements is the most likely person to do
precisely that. They get asked what happened when their service broke in production, and
the product has failed the user it was just rebuilt for.

`StartSessionRequest` has no level field at all. The candidate cannot correct the guess.

## Scope — keep this small

1. **One optional field on starting a session** letting the candidate say where they are:
   student / final-year, recent graduate, or working professional. Optional, not a gate —
   leaving it blank must behave exactly as it does today.
2. **An explicit answer beats the derivation.** `CandidateStage` currently derives from
   title + resume; a stated answer should win over both. Keep the derivation as the default
   when nothing is stated. Do not delete it.
3. **Surface it in the UI** on the existing start-a-session form
   (`apps/web/src/components/new-interview-form.tsx` and whatever `apps/web/src/lib/rounds.ts`
   feeds). Plain, quiet, honest wording — it is a calibration aid, not a quiz. Say briefly
   why it is being asked ("so the questions match where you are"), because an unexplained
   field about your own seniority reads as judgement.
4. **Persist it with the session** so the report scores against the same bar the round ran
   at. Task 048 deliberately avoided adding a column and derives the stage twice instead —
   read `CandidateStage` and `ReportService` and follow that reasoning before you decide.
   If you do add a column, the migration must be applied at merge; say so loudly in your
   report.

## Do not

- Do not make it required, and do not block a session on it.
- Do not add a whole profile/onboarding step. One optional field.
- Do not touch the provenance machinery or anything about employers.
- Do not change the derivation's defaults for candidates who say nothing.

## Tests

- A stated answer overrides the derivation, in both directions: a stated professional with
  a student-looking resume is not given a campus round; a stated student with a plain
  "Software Engineer" title and no resume **is**.
- Saying nothing reproduces today's behaviour exactly — pin this, it is the regression that
  matters most.
- The round refusal from task 048 (no system design for a campus fresher) still holds when
  campus-fresher status comes from the stated answer rather than the derivation.
- API: happy path plus an auth-failure path. Invalid enum value is rejected cleanly.

## Verification

```bash
cd apps/api && ./gradlew ktlintCheck test build
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI and applies migrations.
