# Task 062 — Unified learning experience

## Goal

Make Courses and Arena feel like the same signed-in product as Home and Rounds, improve
course discovery and progression, surface a useful profile overview, and provide a small
daily practice set for every course without runtime scraping or AI spend (PRD §08).

## Scope

- Use the persistent signed-in left rail on Courses and Arena; keep the live interview
  room free of navigation chrome.
- Give Java, DSA, and AI stable visual identities within the existing design tokens.
- Replace the decorative course grid hero with a readable learning path and make the next
  chapter action visually primary.
- Promote the profile photo and derive course/interview/Arena summaries from existing APIs.
- Rotate deterministic, topic-labelled daily sets per course while retaining FSRS for
  personalised practice.
- Add a small reviewed open-source supplement with pinned provenance and MIT notices.

## Non-goals

- No schema, auth, permissions, payment, or interview-engine changes.
- No scraper, runtime third-party question fetch, live model generation, or new dependency.
- No employer-specific questions or claims.

## Verification

- Frontend typecheck, lint, tests, and production build.
- Backend ktlint, tests, and build because the merge gate covers the whole product.
- Feature-branch CI must be green before merging to `develop`.
