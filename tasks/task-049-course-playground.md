# Task 049 — Courses: "Try it yourself" playground + real code highlighting

## Why

The owner's verdict: the courses have *"no place where user could try out things like gfg
has or tutorials point has or w3schools has."* Today a course code block is a plain `<pre>`
with a copy button — no highlighting, no editing, no running.

## Do not reinvent anything — it is already in this repo

| Need | Already present |
|---|---|
| Code editor | `@uiw/react-codemirror` + `@codemirror/lang-java` + `@codemirror/lang-python` |
| Running Python | `apps/web/src/lib/browser-python.ts` — Pyodide 0.26.4 in a Web Worker, 6s hard timeout, worker terminated on overrun, stdin as an in-memory stream |
| A worked example of both | `apps/web/src/components/dsa-workspace.tsx` (the interview coding round) |

**Read `browser-python.ts`'s header comment before designing anything.** It documents real
bugs already paid for: Python execution is synchronous so it must not run on the main
thread; a stdin callback returning `""` spins forever. Do not re-learn those.

## The Java constraint — decided, do not relitigate

**Owner decision, 2026-09-20:** ship Python now, Piston later.

There is no free way to run Java: the public Piston API has been whitelist-only since Feb
2026, self-hosting Piston needs a `privileged: true` Docker sidecar (owner's call on spend
and security), Judge0 is GPLv3 with an unresolved API-use question, CheerpJ needs a
commercial licence, DoppioJVM is dead, TeaVM has only partial class-library support.

So: **build the runner as a pluggable interface with one implementation today (browser
Python).** When the owner green-lights a server runner, adding it must be a new
implementation plus config — not a rewrite of the UI.

Do **not** attempt to run Java. Do **not** add a Java runner, call an external execution
API, or start Docker.

## Scope

### 1. A runnable block kind

Add to `apps/web/src/content/courses/types.ts`. Either a new `playground` kind or an
optional `run` field on the existing `code` block — pick whichever keeps the content files
cleaner, and say why in your report.

It must carry: the language, the starter source, and optionally a prompt/task line and the
expected output. Keep the existing `code` block for non-interactive samples.

### 2. The playground component

`apps/web/src/components/courses/playground.tsx`, a client component.

- CodeMirror editor, seeded with the starter source, with a **Reset to original** control.
- **Run** for Python, through a small runner abstraction over the existing
  `runPython` / `loadPython`. Show stdout and stderr distinctly; show the timeout case
  clearly ("stopped after 6s — most likely an endless loop") rather than silently.
- For **Java**: render the editor, and in place of Run show an honest, quiet line saying
  running Java in the browser is not available yet. No fake Run, no "coming soon" hype, no
  disabled button with no explanation. Keep Copy working.
- **Lazy-load Pyodide.** The interview room pre-loads it because a round is about to need
  it; a course page must NOT pull ~10MB on page load. Fetch on first Run (or on an explicit
  "enable" affordance), with a clear loading state. Getting this wrong makes every course
  page heavy — it is the main performance risk in this task.
- Accessible: keyboard reachable, visible focus ring, output announced to screen readers,
  WCAG AA contrast, works on mobile width.
- The page must still server-render its content for SEO — the playground is an enhancement
  layered on the static block, never a replacement for it.

### 3. Syntax highlighting for static code blocks

Static `code` blocks currently have none. Use **Shiki** (MIT) **at build/server time**, so
the highlighted HTML ships with the page and **zero highlighting JS reaches the browser**.
This is the one new dependency approved for this task — justify it in HANDOFF.md.

Do not use Prism or highlight.js (client-side by design), and do not use CodeMirror
read-only for static blocks (ships the whole editor to display text).

Must work in dark mode via the existing design tokens, and degrade gracefully if a language
is unknown.

### 4. Prove it on a few chapters only

Convert a handful (roughly 4–6) of runnable examples as proof — Python ones, so Run
genuinely works. **The bulk content pass is task 050, not this task.** Do not convert all 65
chapters here.

### 5. Tests

- Runner abstraction: unit-tested, Pyodide mocked at the boundary. No test may hit a live
  third-party API or download Pyodide.
- Playground behaviour and accessibility, not snapshots: editing updates source, Reset
  restores it, output regions are labelled, the Java state shows the explanation and no
  Run, keyboard reachability.
- Extend `content-integrity.test.ts` for the new block kind.
- A test pinning the lazy-load contract — that merely rendering the page does not trigger
  an interpreter fetch.

## Non-negotiables

- Never weaken, skip, or ignore a test to get green.
- No new dependency beyond Shiki without justifying it in HANDOFF.md.
- Do not touch `apps/api/`. Do not touch the interview room or `dsa-workspace.tsx` — reuse
  its patterns, but leave the interview flow alone.
- Design direction is CLAUDE.md's 15 Sep 2026 revamp. No emoji as iconography.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Also report the course page's client bundle size before and after — the lazy-load
requirement above is only real if it is measured.

Push the branch. Do not merge — the orchestrator merges on green CI.
