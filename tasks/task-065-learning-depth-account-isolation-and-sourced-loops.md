# Task 065 — Learning depth, account isolation, and sourced loop discovery

## Goal

Make the signed-in experience trustworthy and genuinely useful: course explanations
must teach each concept before using it, dashboard data must never survive an account
change, and unfamiliar employer interview patterns must use cited public evidence when
it is available.

## Scope

- Remove the writing-mode availability notice from the interview room.
- Expand every course concept's Explain and Remember material with beginner-first
  definitions, relatable examples, and useful recall guidance.
- Clear and identity-gate dashboard and profile data across sign-out, account switch,
  failed refresh, and delayed responses.
- Add targeted, source-grounded employer-pattern discovery behind a mocked boundary;
  retain an explicit archetype fallback when credible sources cannot be found.
- Preserve provenance in every employer-specific claim and avoid bulk scraping.

## Acceptance criteria

- A previous account's sessions cannot render or mutate after the active token changes.
- Tests cover account change, failed refresh, and delayed stale responses.
- Course integrity tests enforce substantial Explain and Remember content.
- Unknown employers can receive cited public-process information through the research
  boundary, while tests make no live AI or network calls.
- Frontend and backend verification loops pass locally; the branch is pushed and left
  in a human-review PR because the change affects user-data isolation.

## Out of scope

- Bulk crawling or scraping.
- Live Gemini calls, live interviews, or other paid validation.
- Changes to authentication, payments, database ownership, or row-level-security policy.

