# Task 044 — Site-wide visual revamp (InterviewBit style)

Owner request, 15 Sep 2026: "revamp our website like https://www.interviewbit.com/ …
this currently looks hand-written and doesn't look fancy to the audience … change the
colour themes across." CLAUDE.md "Design direction" was rewritten for this; read it.

Branch: `feat/interviewbit-revamp` from `origin/develop`. Frontend only (`apps/web`).

## Do
1. **New design tokens** in `apps/web/src/app/globals.css`. Keep the token *names*
   (`--surface`, `--ink`, `--accent`, …) so every existing page re-themes at once; add
   new ones you need (e.g. `--navy`, `--accent-2` green, `--highlight` amber,
   `--surface-tint` soft blue, shadow tokens). Retune dark mode to match. Check AA
   contrast for text on every surface you define.
   Suggested palette (adjust with judgement): primary blue ~`#1a64f0`, navy
   ~`#0b1a33`, soft-blue section `#f2f6ff`, white cards, success green ~`#12a150`,
   amber ~`#f5a524`, ink ~`#0f172a`, muted ~`#475569`.
2. **Typography:** replace the serif headings with a bold modern sans via `next/font/google`
   (e.g. Plus Jakarta Sans or Inter — built into Next, not a new dependency). Keep a mono.
3. **Landing page (`src/app/page.tsx`)** rebuilt as a marketing page, InterviewBit-like:
   sticky top nav (logo, Mock interviews, Courses, Sign in / Start free), navy hero with
   a clear promise + primary CTA + secondary CTA to `/courses`, a hero visual built in
   SVG/HTML (e.g. a mock interview card with a waveform and a report score) — not stock
   abstract blobs; strip of employers we cover (text wordmarks, no logos we don't own);
   sections for voice mock interviews, the feedback report, the free courses (Java,
   DSA — link to `/courses`, it is being built in parallel by task 045; if the route
   doesn't exist on your branch yet, link anyway); "how it works" steps; a CTA band; a
   proper footer. True statements only — no invented user counts, ratings, testimonials.
4. **Re-skin the app shell and every existing page** (dashboard, interview/new, rounds,
   report, profile, login) to the new look: cards with soft border + shadow, pill
   badges, primary buttons in the blue, clear section headers. Behaviour unchanged. The
   live interview room stays near-empty (CLAUDE.md) — recolour only.
5. Add a shared nav entry "Courses" → `/courses` in the app shell/rail nav if one exists.
   (Task 045 may also add it; the orchestrator will resolve the merge.)

## Don't
- No new npm dependencies. No component library. No behaviour/API changes.
- Don't touch interview logic, capture, consent copy, or report content logic.

## Verify
`cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build`.
Update tests only where they assert on removed markup/copy — never weaken a behavioural
or accessibility assertion. Run the dev server and eyeball the landing page, dashboard
and report if you can (no live AI calls — CLAUDE.md rule 7).

Commit in coherent steps (`feat: … (PRD §design)`), push the branch, stop. The
orchestrator merges.
