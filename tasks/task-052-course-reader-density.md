# Task 052 — Course reader: use the screen, and show rather than tell

## The owner's verdict, after looking at the live pages

> "I still don't like how the course material is portrayed — it seems really congested and
> theoretical. Why is there so much space on the left side and right side? Use the screen
> space. You can use visualization also that depicts the text that is written, so things can
> easily be understood by candidates — like coloured circles, boxes etc. wherever written.
> Visualize this like GfG does, use similar patterns. Look for other opportunities to improve
> the visuals. Also don't reinvent the wheel, there is enough open source, use that."

Task 047 added a `viz` block kind and converted 16 chapters. That was the right foundation
and it is not enough: **46 of the 65 chapters still render their walkthroughs as a numbered
list of sentences.** The backtracking chapter is the owner's example — nine lines of prose
describing pointer movement that a picture would show at a glance.

## The measured layout problem

- `apps/web/src/app/courses/[course]/[chapter]/page.tsx` line 80:
  `mx-auto grid max-w-6xl ... xl:grid-cols-[220px_minmax(0,70ch)_180px]`
  On a 1400px+ screen the whole thing is capped at `max-w-6xl` (1152px) and the prose column
  is 70ch, so roughly 250px is dead on each side and diagrams are squeezed into a text-width
  column they do not want to be in.
- `apps/web/src/app/courses/[course]/page.tsx` line 63: the module list is `max-w-3xl` —
  very narrow for what is essentially a two-column index.

## Scope

### 1. Use the screen

- Widen the chapter layout at `xl` and above. Keep prose itself readable — long lines of body
  text are genuinely harder to read, so the answer is **not** "stretch the paragraph to
  1800px". The answer is a wider overall grid with a more generous side rail, and
  **full-bleed treatment for the things that want width**: `viz` blocks, `code` blocks,
  playgrounds, tables. A diagram should be allowed to break out of the prose column.
- Make the left chapter rail and right "on this page" rail earn their space, or reclaim it.
- Widen the course index page and give it a real two-column module layout.
- Check 1280px, 1440px and 1920px. Mobile and tablet must not regress.

### 2. A visual vocabulary — the "GfG-like" part

Today the only visual is a full `viz` block. What is missing is the *small* stuff: the
coloured boxes, chips, labelled arrows and callouts that break a wall of text into something
scannable. Add a small, deliberate set and use it. Suggestions, not a fixed list — judge what
the content actually needs:

- **Key-term chips / coloured inline badges** for the term being defined.
- **Concept cards** — a titled, tinted box for a definition or a rule, distinct from the
  existing `analogy` and `remember` boxes.
- **Comparison / versus blocks** — two or three tinted columns side by side (`ArrayList` vs
  `LinkedList`, BFS vs DFS, `==` vs `.equals`). These are everywhere in the content and are
  currently plain tables.
- **Step-flow / pipeline strips** — numbered, coloured stages with arrows, for anything
  sequential (compile → bytecode → JVM; the choose/explore/undo of backtracking).
- **Complexity badges** — O(n), O(log n) etc. as consistent coloured pills, since these recur
  constantly and are currently buried in prose.

Rules for all of it:
- **Never encode meaning in colour alone** — pair colour with a label, shape or position.
  This already holds for `viz` (see `viz-tokens.ts`); keep it.
- Use the existing design tokens. The 15 Sep 2026 direction: white and soft-blue surfaces,
  deep navy, one saturated primary blue, green for success, amber for highlights. Dark mode
  must work.
- **No emoji as iconography** — draw in SVG.

### 3. Don't reinvent the wheel

- The `viz` framework from task 047 already exists with eight shapes and a step control.
  **Reuse and extend it. Do not build a second visualisation system.**
- Shiki, CodeMirror, Pyodide and Excalidraw are already dependencies.
- If you believe a new dependency genuinely helps here, justify it in your report against
  what is already present. The 047 research concluded hand-rolled SVG beat d3/mermaid/
  react-flow for this kind of teaching diagram; that conclusion still stands unless you find
  a specific case it does not cover.

### 4. Prove it on real chapters

Apply the new vocabulary to **at least 8 chapters**, chosen where the text is densest —
including `dsa/11-backtracking.ts`, which the owner pointed at directly. Convert its
`trace` block to a `viz` while you are there.

Do **not** attempt all 46 remaining chapters here; that is task 054, and it needs this
vocabulary to exist first.

## Tests

- Behaviour and accessibility, not snapshots. New components: keyboard reachable where
  interactive, labelled, adequate contrast, sensible heading order.
- Extend `content-integrity.test.ts` for any new block kinds.
- A test that full-bleed blocks do not break the page's horizontal scroll at mobile width.

## Non-negotiables

- Never weaken, skip, or ignore a test to get green.
- Do not touch `apps/api/` or the report (task 053 is there).
- Do not regress the 047 visuals, the 049 playground, or the 050 Java/Python toggle.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI.

**Report what a human must look at.** This task is explicitly about how something looks, and
CI cannot judge that. Say which pages and widths you would want the owner to check.
