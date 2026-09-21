# Task 047 — Courses: visual, step-through representations

## Why

The owner's verdict on the courses as they stand: *"just pure theory, there is no visual
representation."* Both courses (35 Java chapters, 30 DSA chapters) are prose, code and
tables only. `apps/web/src/content/courses/types.ts` has no block kind that draws anything.

This task adds the missing visual layer. It is the single biggest win available for the
courses and it depends on nothing external.

## The key insight — the data is already there

Many chapters already carry `{ kind: "trace", title, steps: string[] }` blocks: a dry run,
step by step, for anything with changing state. Those are **prose descriptions of exactly
the frames a visualiser would draw**. See `dsa/06-sliding-window.ts` — two `trace` blocks,
one walking a fixed window across `{2,1,5,1,3,2}`, one shrinking a variable window over
`"abcabcbb"`.

So the job is to add a *structured* sibling to `trace`, where the steps carry data rather
than sentences, and a renderer that draws them with a step control.

## Scope

### 1. A `viz` block kind

Add to `apps/web/src/content/courses/types.ts`. Declarative and data-driven — the content
file describes *state per frame*, never SVG coordinates. Suggested shape (refine if you
find better while implementing, but keep it declarative):

```ts
| { kind: "viz"; title: string; caption?: string; viz: Viz }

type Viz =
  | { type: "array"; frames: ArrayFrame[] }        // cells, pointers, window range, highlights
  | { type: "list"; frames: ListFrame[] }          // linked list nodes + next arrows
  | { type: "stack" | "queue"; frames: SeqFrame[] }
  | { type: "tree"; frames: TreeFrame[] }          // binary tree, node states (visiting/done)
  | { type: "graph"; frames: GraphFrame[] }        // nodes + edges, visit order
  | { type: "table"; frames: GridFrame[] }         // DP tables, hash buckets
  | { type: "callstack"; frames: CallFrame[] }     // recursion
```

Every frame carries a `note: string` — the one-line explanation shown under the drawing for
that step. That note is what makes it teaching rather than decoration.

### 2. The renderer

`apps/web/src/components/courses/viz-block.tsx` (plus per-shape components).

- **Inline SVG, hand-rolled.** Research verdict: for arrays, pointers, windows, lists,
  stacks, queues, sorting, recursion and hash tables, a declarative frames→SVG renderer is
  cheaper and more controllable than any dependency. **Add no new dependency for these.**
- Trees and graphs need layout. Try a hand-rolled layout first — course examples are small
  (< 20 nodes) and a simple binary-tree layout plus a fixed-position or radial graph layout
  is not hard. **Only if that genuinely fails**, `dagre` (MIT, small) is pre-approved for
  layout alone. `react-flow` is NOT approved for this task — too heavy for static teaching
  diagrams. If you add `dagre`, justify it in HANDOFF.md.
- **Controls:** previous / next / play / reset, plus a step slider. Keyboard accessible
  (arrow keys), with a visible focus ring. Respect `prefers-reduced-motion` — no autoplay
  and no transition when it is set.
- **Must be legible without JavaScript and without colour.** Server-render frame 0 so the
  diagram is in the HTML for search engines and for a reader with JS off. Never encode
  meaning in colour alone — pair every colour with a label, shape or position.
- Dark mode must work, using the existing design tokens. Do not hard-code hex values that
  bypass the token system — follow what the other course components do.

### 3. Apply it to the content

Do not add a `viz` block to all 65 chapters in this task — that is a content run, not a
framework run. Convert **the chapters where a picture carries the most weight**, roughly
12–18 chapters, prioritising:

- DSA: arrays in memory, two pointers, sliding window, prefix sums, recursion, the three
  sorts (simple / merge / quick), binary search, linked lists, stacks, queues, tree
  traversals, BSTs, heaps, graph BFS/DFS, DP intuition.
- Java: arrays, strings vs StringBuilder, stack/heap/GC, ArrayList vs LinkedList,
  HashMap internals.

Where a `trace` block already covers the same ground, **replace it** with the `viz` block
rather than leaving both — the whole point is that the picture beats the paragraph. Keep
`trace` as a block kind; other chapters still use it.

### 4. Tests

- Unit-test the frame logic and any layout maths.
- Test the renderer's **behaviour and accessibility**, not snapshots (project rule):
  stepping forward/back changes the announced note, controls are reachable by keyboard,
  the step control has an accessible name, reduced-motion disables autoplay.
- Extend `apps/web/src/content/courses/content-integrity.test.ts` to cover `viz` blocks:
  every frame has a note, frames are non-empty, referenced indices are in range.

## Non-negotiables

- Do not weaken or skip a test to get green. Do not add an ignore directive.
- Do not restyle the courses generally or touch the landing page — visuals only.
- Content accuracy: a frame that shows a wrong intermediate state is worse than no
  picture. Where a `viz` replaces a `trace`, the frames must say the same thing the
  sentences did.
- The design direction is the 15 Sep 2026 one (bright, confident, InterviewBit-like —
  white/soft-blue surfaces, deep navy, saturated primary blue, green for success, amber
  for highlights). Read `CLAUDE.md` § Design direction. Do not restore the old "ink on
  paper" look.
- No emoji as iconography.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI.
