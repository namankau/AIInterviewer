# Task 060 — Site-wide premium design system

## Goal
Apply the owner-approved bright, confident learning-platform visual language across the website through shared semantic tokens and reusable UI primitives.

## Scope
- Establish a coherent palette, typography scale, surfaces, borders, shadows, radii, focus states, and interaction states.
- Migrate the landing page, authentication, dashboard, course discovery, interview setup, report/history, profile/settings, and shared navigation/footer surfaces.
- Preserve the live interview room's deliberately minimal information density while aligning its tokens and accessibility.
- Reuse the existing React, Tailwind, and native HTML stack; add no component framework.
- Keep all product behavior, auth boundaries, privacy copy, and employer-provenance claims unchanged.

## Acceptance criteria
- Shared semantic tokens are the source of truth for page surfaces and common components.
- Major public and signed-in routes feel visually related to the approved guided-course experience.
- Controls retain visible focus, adequate contrast, responsive behavior, and existing semantics.
- Existing UI behavior tests pass, with focused coverage for any changed shared primitive behavior.
- Frontend typecheck, lint, tests, and production build pass; backend verification remains green.
- Representative desktop and mobile visual QA is recorded.

## Out of scope
- New product features, pricing, payment wiring, authentication behavior, interview logic, or course-content rewrites.
- Adding live interview hints, scores, or other distracting chrome.
- New third-party UI or state-management dependencies.
