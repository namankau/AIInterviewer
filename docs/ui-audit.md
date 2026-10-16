# UI audit — 16 October 2026

## Scope and product direction

Untiered is a voice-first mock interview and learning platform for candidates preparing for company and role-specific interviews. The repository uses Next.js 16 App Router, React 19, Tailwind CSS 4, and a small set of local UI primitives. This audit covers the web application at `apps/web`; it does not change interview, account, or course behavior.

The established design direction in `AGENTS.md` is a bright learning platform: white and soft-blue surfaces, navy hero bands, saturated blue actions, restrained green and amber accents, and a sparse live interview room. The existing `globals.css` already implements much of this direction, so the redesign should consolidate it instead of replacing it with a different aesthetic.

## Screen inventory

| Route or boundary | Screen and primary UI |
| --- | --- |
| `/` | Marketing landing page, employer coverage, feature sections, testimonials, footer |
| `/login` | Sign-in and sign-up, password recovery, Google sign-in |
| `/auth/update-password` | Password update form |
| `/dashboard` | Personalized overview, next actions, progress, question of the day |
| `/interview/new` | Company/role setup, resume, consent, device check, round selection |
| `/interview/[id]` | Interview room, preparation brief, live voice interaction, completion |
| `/report/[id]` | Report loading, evidence, charts, recommendations |
| `/history` | Past rounds and report links |
| `/rounds` | Round selection and overview |
| `/questions` | Company question-bank index |
| `/questions/[slug]` | Company question detail |
| `/courses` | Course catalogue, search and filters |
| `/courses/[course]` | Course overview and curriculum |
| `/courses/[course]/[chapter]` | Lesson reader, code, quiz, visualizations and local navigation |
| `/arena` | Scenario practice index |
| `/arena/[course]` | Course-specific Arena session and feedback |
| `/daily-challenge` | Daily practice challenge |
| `/profile` | Profile, resume, preferences, account settings |
| `/upgrade` | Upgrade information |
| `/privacy`, `/terms`, `/contact` | Legal and contact information |
| App, global, interview errors; not-found | Failure and missing-page recovery |
| Dashboard, new interview, questions, history, rounds, report, profile, courses, Arena, upgrade loading boundaries | Route skeletons (mostly via `RouteLoading`) |

## Shared component inventory

**Existing primitives:** `ui/button`, `ui/action-link`, `ui/field` (label, hint, input, select, textarea), `ui/card`, `ui/badge`, and `ui/page-header`. `errors/error-panel` and `route-loading` are shared feedback patterns.

**Site and account:** `app-shell`, `rail-nav`, `site-nav-links`, `site-footer`, `brand-logo`, `breadcrumbs`, `account-summary`, `sign-out-button`, `sign-in-with-google`, `email-password-auth`, `password-update-form`, `profile-panel`, `delete-account-section`, `legal-page`, and `turnstile-challenge`.

**Interview and reports:** `new-interview-form`, `device-check`, `loop-brief-step`, `interview-room`, `interviewer-presence`, `round-clock`, `interview-complete-panel`, `report-view`, `report-charts`, `session-link`, `dashboard-panel`, `dashboard-question-of-day`, `daily-limit-notice`, `continue-learning`, `question-bank-index`, `company-questions`, `spoken-english-panel`, and `testimonials`.

**Courses:** `course-catalogue`, `course-site-header`, `course-toc`, `course-progress`, `guided-lesson`, `guided-lesson-controls`, `guided-lesson-progress`, `daily-challenge-banner`, `block-renderer`, `code-block`, `copy-code-button`, `concept-card`, `compare-block`, `steps-block`, `quiz-block`, `playground`, `playground-lazy`, `on-this-page`, `inline-text`, `import-browser-progress`, `code-language-context`, `course-visuals`, `architecture-lab`, `agent-lab`, and `viz-block` with array, callstack, graph, grid, list, sequence, and tree visualizations.

**Arena and progress:** `arena-course-practice`, `arena-daily-quest`, `arena-play-panel`, `arena-session`, `arena-viz-frame`, `challenge-card`, `progress-summary`, `import-browser-arena`, and `proof-of-progress/progress-page-prototype`.

**Other workspaces:** `dsa-workspace` and `design-workspace` are specialized tools embedded in the interview and lesson experience.

## Findings

1. **A foundation exists, but it is incomplete.** `globals.css` has semantic light/dark colors, a font scale, radius, shadows, focus ring, motion, and Tailwind theme aliases. It lacks a documented neutral 50–900 scale, spacing and layout tokens, z-index layers, and named responsive/container roles. Larger display text uses Georgia while the brief calls for one modern sans family. The existing theme should be extended and documented.
2. **Controls drift between screens.** The shared `Button` covers primary/secondary/quiet but lacks destructive, loading, and full small-screen sizing. Its `sm` size is only 36px high. `Field` exposes raw controls but no integrated helper/error state, checkbox, radio, or switch. Login, profile, new interview, Arena, courses, and retry states frequently create their own buttons and inputs with different heights, padding, radii, and focus treatment.
3. **Repeated visual patterns are handwritten.** Navy hero headers recur in questions, device check, brief, and Arena. Raised cards recur with `rounded-[1.35rem]`, `rounded-[1.5rem]`, `rounded-[1.65rem]`, `rounded-[1.75rem]`, and `rounded-[2rem]` even though `Card` exists. Search/filter pills, progress bars, and tab strips are repeated. These should become shared compositions or use a common class/token.
4. **Screen-level values bypass tokens.** Examples include `bg-[#102748]` in Arena, `bg-[#a8e7d7]` in account/profile/dashboard, `bg-[#303b94]` in the report, and bespoke gradients in profile/course artwork. Arbitrary width, radius, spacing, and sizes appear in route and component markup. Some inline styles are legitimate data-driven positions/percentages and should stay dynamic while their colors and geometry are tokenized.
5. **Loading and feedback are uneven.** Most signed-in index routes use `RouteLoading`, but several dynamic and secondary routes have no local loading boundary. The shared skeleton is generic rather than matching each screen. Error recovery is strongest in `ErrorPanel`; inline API failures and empty results have one-off styling and controls. Success feedback also varies between forms and practice flows.
6. **Navigation differs by context.** `AppShell` provides a sticky horizontal navigation while the chapter reader uses `course-site-header`; the landing and login pages use separate headers. This is reasonable for context, but their heights, content widths, active states, and tap targets need shared layout roles.
7. **Accessibility risks are concrete.** Several visible interactive controls use `min-h-10` (40px) or `size-9` (36px), below the requested 44px target (`email-password-auth`, course filter buttons, profile avatar control, shared small Button). The course catalogue search uses placeholder text without a visible label. Icon-only and custom control flows need a label/focus audit. The global focus rule is a good base, but one-off `focus-visible:outline-none` declarations and low-contrast subtle text require review. `animate-pulse` skeletons need the existing reduced-motion rule verified against them.
8. **Dark mode is token-based but fragile where values are literal.** The root switches tokens on `prefers-color-scheme: dark`, while literal white/navy/blue values in profile, Arena, and visual decorations do not switch. These can produce inconsistent dark surfaces and contrast.

## Consolidation plan

1. Extend the current token sheet and document usage. Keep the owner's bright navy/blue direction and the interview room's sparse layout.
2. Strengthen the primitives already in use; add shared patterns when a real screen needs them. Preserve native form and keyboard behavior.
3. Replace literal presentation values and one-off control classes across route groups: shell/marketing/auth, interview/report/profile, then courses/Arena. Keep data-driven chart dimensions and course illustrations where they encode information.
4. Verify typecheck, lint, tests, and build after each phase; inspect responsive and light/dark layouts. Do not touch API contracts, business logic, data models, or routes.
