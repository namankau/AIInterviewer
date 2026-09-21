# Task 054 — Convert the remaining chapters to the visual vocabulary

## Why

The owner, after reading the live pages: the courses are *"congested and theoretical"*, and
walkthroughs should be pictures — *"coloured circles, boxes etc. wherever written. Visualize
this like GfG does."*

Tasks 047 and 052 built everything needed and proved it on 24 chapters between them.
**Roughly 38 chapters are still untouched**, and in those the walkthrough is still a numbered
list of sentences. This task finishes the job.

This is a content run, not a framework run. **Build nothing new unless you genuinely cannot
express something** — and if that happens, say so rather than inventing a parallel system.

## The vocabulary you already have

From task 047 — `viz` blocks, with `array | list | stack | queue | tree | graph | table |
callstack`, each frame carrying a `note`, with a step control.

From task 052:
- `concept` — a tinted definition/rule card.
- `compare` — 2-3 tinted columns side by side.
- `steps` — a numbered pipeline strip.
- `{{O(n)}}` inline → complexity pill.
- `~~term~~` inline → key-term chip.
- Full-bleed: `viz`, `code`, `playground`, `table`, `compare`, `steps` get the full width;
  prose stays at 70ch.

Read `dsa/11-backtracking.ts` first — it is the reference for what "done well" looks like.

## Scope

Work through the remaining chapters in `apps/web/src/content/courses/{dsa,java}/`:

1. **Every `trace` block becomes a `viz`** where the thing being traced has visual state —
   which is nearly all of them. A `trace` should survive only where what changes genuinely
   is not picturable; justify each survivor in your report.
2. **Replace genuine before/after tables with `compare`.** Keep a `table` where its job is a
   numeric reference (complexity tables) — and note the DSA content-integrity rule requires
   at least one `table` per DSA chapter with a non-empty reason column.
3. **Add `concept` cards** for the definition or rule each chapter turns on.
4. **Add `steps`** wherever something is sequential.
5. **Pillify complexities** with `{{...}}` and chip the key term with `~~...~~` on first use.
   Do not over-apply — a page where everything is highlighted highlights nothing.

## Accuracy outranks decoration

- A frame showing a wrong intermediate state is worse than no picture. Where a `viz` replaces
  a `trace`, **the frames must say exactly what the sentences said.**
- Do not invent teaching content. This is a presentation pass over existing, reviewed prose.
- Do not weaken any existing chapter's content to make it fit a block kind.

## Split the work

~38 chapters is far too much for one commit. Go **module by module**, committing and pushing
after each batch, the way tasks 045/046/050 were run. Agents on this run have been killed by
usage limits and network drops; the ones that pushed after every batch lost nothing.

If you run short, a clean partial covering whole modules beats a rushed sweep. Say clearly
which chapters are done and which remain.

## Tests

- `content-integrity.test.ts` already checks frame notes, in-range references, and the shape
  of `concept`/`compare`/`steps`. Extend it if you find a class of mistake it would not catch.
- Consider a test that asserts how few `trace` blocks remain, so this does not silently
  regress later.

## Non-negotiables

- Never weaken, skip, or ignore a test to get green.
- No new dependency.
- Do not touch `apps/api/`, the report, or the landing page.
- Do not regress 047's visuals, 049's playground, 050's Java/Python toggle, or 052's layout.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI.
