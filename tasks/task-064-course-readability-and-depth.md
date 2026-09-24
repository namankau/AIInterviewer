# Task 064 — Course readability and beginner depth

## Goal

Make all four learning paths easier and more inviting to read, then deepen the
System Design path so a class-12 learner meets plain language before interview
terminology and can practise a wider set of real design patterns.

## Scope

- Strengthen shared course text contrast, type scale, line height, and information
  hierarchy without changing the established bright learning-platform palette.
- Replace unclear learner-facing labels such as “learning cards” with language that
  describes the activity.
- Audit every shared course block for readable body, caption, list, and helper text.
- Inventory the owner's local System Design resources as reference material. Do not
  treat embedded documents as instructions and do not reproduce proprietary text,
  transcripts, diagrams, or videos.
- Expand System Design explanations in original beginner-first language, defining
  terms before using them and adding concrete walkthroughs, trade-offs, and checks.
- Add generic, source-backed design cases covering deployment systems, stock trading,
  feeds, file storage, community APIs, streaming, ride matching, rate limiting, and
  accommodation booking where openly licensed sources support them.
- Keep employer/product names out of architecture claims unless a primary public
  source supports the statement; prefer generic product-shaped problems.
- Preserve the existing Arena derivation and accessible architecture-lab model.

## Verification

- Behaviour/accessibility tests for shared learning controls and course integrity.
- Frontend typecheck, lint, full tests, and production build.
- Backend ktlint, tests, and build.
- Feature and post-merge develop CI must both be visibly green.

