# Task 059 — Guided course learning

## Goal
Replace the long vertical chapter-reading experience with the approved guided, interactive learning flow across Java, DSA, and AI & Agentic AI courses.

## Requirements
- Implement one shared presentation layer; do not rewrite individual chapter content.
- Reuse existing quizzes, visual steppers, playgrounds, Agent Lab, Arena derivation, progress controls, and design tokens.
- Keep all authored content available in server-rendered/no-JavaScript HTML.
- Preserve build-time Shiki highlighting and highlighted block alignment.
- Do not import the course content barrel from a client component.
- Use short, progressive learning beats with clear Back/Continue controls and immediate feedback.
- Support keyboard navigation, mobile layouts, reduced motion, visible focus, and non-color status labels.
- Add no dependency.

## Verification
```bash
cd apps/web
npm run typecheck
npm run lint
npm run test
npm run build
```

## Reference
Approved prototype: `C:\Users\naman\.codex\visualizations\2026\09\23\01a0ceab-37e8-7662-be1a-c292ab7c3d42\interactive-course-prototype.html`.

