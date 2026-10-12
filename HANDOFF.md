# Handoff — 2026-10-12

## Task
Add deployment-configurable product/course feature gates and a genuine testimonial section. User request; no task file.

## What I built
- Added central web flags in `apps/web/src/lib/flags.ts` and matching API configuration in `apps/api/src/main/resources/application.yml` for Mock Interviews, Courses, Arena, Reports, and Questions.
- Enforced disabled states across navigation, landing content, direct routes, dashboard/profile requests, and matching API routes; disabled surfaces answer with 404 and session deletion remains available.
- Added independent Java, DSA, AI Agents, and System Design course gates. Unknown courses default off until explicitly registered.
- Added a responsive testimonial section and typed registry in `apps/web/src/components/testimonials.tsx` and `apps/web/src/content/landing-testimonials.ts`. The entire section stays absent until genuine, approved content is added.
- Added web behaviour tests and API interceptor tests for enabled/disabled paths.

## Assumptions I made
- The five implemented product surfaces are Mock Interviews, Courses, Arena, Reports, and Questions. Community is not implemented and the settled product decisions explicitly defer it, so I did not scaffold a placeholder Community surface.
- Public web flags are build/deployment configuration because Next.js embeds `NEXT_PUBLIC_*` values; matching API flags are runtime configuration.
- The existing question-bank environment variable remains a backwards-compatible fallback, while the new Questions flag takes precedence.
- The 854-line change is intentionally one PR because product gating is cross-cutting and the testimonial registry is a small, independently tested part of the same requested delivery.

## What I could NOT verify
- No real candidate quote, display name, context, or approved profile photo was provided, so the production testimonial registry is intentionally empty.
- Final visual-design approval remains a human decision; the default landing page was rendered and checked for obvious layout problems.

## Verification status
- Frontend local: typecheck pass; lint pass; 70 test files / 2,995 tests pass; production build pass.
- Backend local: `ktlintCheck test build` pass.
- Remote CI: web, API, and Docker image jobs passed on PR #60 before merge; the documentation-only handoff commit was also required to pass before merge.

## Merge status
- PR #60 was merged into `develop` only after visible green CI on the final branch head. `main` was not modified.

## Suggested next task
- Add the daily Question of the Day email as a separate deliverability-focused change after choosing the sending provider and supplying production credentials.

## Open questions for you
- Please provide each testimonial's approved quote, display name, optional context, and profile image before enabling visible social proof.
