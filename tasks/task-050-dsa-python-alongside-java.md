# Task 050 — DSA course: Python alongside Java

**Depends on task 049** (the playground block kind and the runner must exist first).

## Why

**Owner decision, 2026-09-20:** add Python alongside Java in the DSA course.

Two reasons, both real:

1. **Audience.** A large share of Indian campus students prep in C++ or Python, not Java. A
   Java-only DSA course turns them away at the first code block. The product's stated
   differentiator is coverage — this is the same argument applied to language.
2. **It is what makes "Try it yourself" actually work.** Python is the one language this
   stack can run for free today (Pyodide, already in the repo). Java cannot run in the
   browser and is waiting on a server-runner decision. So every Python example added here
   becomes a genuinely runnable example.

C++ was considered and explicitly not chosen — it needs the same server runner Java does.

## Scope

- The **DSA course only** (`apps/web/src/content/courses/dsa/`, 30 chapters). The Java
  course stays Java — it is a course *about Java*.
- Every code block gets a Python equivalent alongside the existing Java, switchable in the
  reader. Default tab: remember most of this audience is coming for DSA, not for Java —
  pick a sensible default and say why in your report.
- The Python must be **idiomatic Python**, not Java transliterated into Python syntax. Use
  `list`, `dict`, `set`, f-strings, tuple unpacking, `collections.deque`, `heapq` where they
  are the natural choice. A `for i in range(len(arr))` where `enumerate` belongs is a
  failure of this task.
- Where a chapter's *teaching point* is language-specific (e.g. Java's `==` vs `.equals`,
  `StringBuilder`, primitive vs wrapper, array covariance), do not force a misleading
  Python parallel. Note the difference honestly — "Python has no direct equivalent, here is
  what it does instead" is correct and useful, and often the most interesting paragraph on
  the page.
- Make the Python examples **runnable playground blocks** (task 049's block kind) wherever
  the example is self-contained.

## Output must be real

`types.ts` says of the existing `output` field: *"real `java` output, pasted, not guessed."*
Hold the Python to the same bar.

**Run every Python snippet and paste its actual output.** Do not predict it. If you cannot
execute Python in your environment, say so plainly in your report and mark which outputs are
unverified — do not quietly guess. (Running Python locally is not AI spend and is not
restricted by CLAUDE.md rule 7.)

## Tests

- Extend `content-integrity.test.ts`: every DSA code block that has a Java version has a
  Python version, both non-empty, and any stated output is non-empty.
- Test the language switcher's behaviour and accessibility (not snapshots): switching
  updates the shown source, tabs are keyboard reachable and labelled, and the choice is
  applied consistently on a page with several blocks.
- Consider whether the reader's language choice should persist across chapters. If you make
  it persist, it must not break server rendering or cause hydration mismatch.

## Watch out for

- This is 30 chapters of content. **Split it** — module by module, pushing after each, the
  way tasks 045/046 were run. One commit with 30 chapters of new code is unreviewable and
  contradicts CLAUDE.md's ~800-line guidance.
- Do not regress the visuals added by task 047 or the playground from task 049 — rebase on
  `develop` after those merge rather than branching from an older point.
- Algorithmic correctness matters more than prose here. A wrong Python implementation in a
  DSA course is worse than no Python at all.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI.
