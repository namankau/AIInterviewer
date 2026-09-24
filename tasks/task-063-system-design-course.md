# Task 063 — System Design course and architecture lab

## Goal

Add a fourth, beginner-friendly System Design learning path that progresses from
core system-design thinking through distributed-system building blocks, AI and
agent architecture, and reusable case-study patterns. Give learners a practical
way to compose and check architectures, not only read about them.

## Scope

- Register a `system-design` course with four modules and 38 concise chapters.
- Keep every lesson at class-12 accessibility: analogy, small steps, explicit
  trade-offs, common mistakes, interview framing, and quick checks.
- Add original quizzes throughout so the existing Arena derives a substantial,
  topic-labelled System Design practice corpus and daily quest automatically.
- Add a reusable, deterministic architecture-composition block with accessible
  drag-and-drop plus a non-drag placement control, multiple accepted solutions,
  actionable feedback, reset, and keyboard/screen-reader support.
- Include scenarios for a URL shortener, ticket booking, RAG assistant, and
  tool-using agent.
- Give the fourth course a distinct premium catalogue treatment and remove
  three-course assumptions from the Courses and Arena entry pages.
- Credit the permissively licensed primary sources that informed the original
  curriculum. Do not copy paywalled course material or unverifiable employer
  architecture claims.

## Verification

- Frontend typecheck, lint, tests, and production build.
- Backend ktlint, tests, and build.
- Feature-branch CI and post-merge `develop` CI must both be green.

