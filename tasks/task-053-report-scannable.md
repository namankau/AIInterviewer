# Task 053 — The report: show the result, don't make them read an essay

## The owner's verdict, after looking at a live report

> "Make reporting better too… it also seems a lot of theory that the candidate has to read,
> correct this too."

A candidate finishing a mock interview wants to know, in about five seconds: *how did I do,
what specifically went wrong, and what do I do next.* Today they get a wall of prose, and the
answer is in there somewhere.

Concretely, from the live page:
- The page is `max-w-3xl` — narrow, so everything stacks into one long column.
- The score band explanation runs to a full paragraph of calibration theory ("The scale is
  set deliberately hard. 40% is a competent, ordinary answer and where most rounds land…").
  That is good writing and the candidate did not ask for it at that moment.
- Competency detail, assessed areas, assistance, outcome simulation and question sources are
  all long prose sections in sequence.

## The goal

**Visual first, prose on demand.** Nothing in the report may be *deleted* — the evidence,
the quotes and the honesty about provenance are the product. The job is to change what is
immediately visible from what is available on request.

## What already exists — reuse it

`apps/web/src/components/report-charts.tsx` already has `OverallScore`, `CompetencyBars`,
`overallScore` and `bandFor`. `report-view.tsx` (551 lines) holds the sections. **Extend
these rather than starting again.**

Before writing any chart code, **read the `dataviz` skill** — it covers chart choice, colour
formulas that stay accessible in light and dark, stat tiles and layout. Follow it.

## Scope

### 1. A summary the candidate reads in five seconds
At the top: the overall band, the two or three competencies that were strongest, and the two
or three that were weakest, as a visual — not a paragraph. A candidate should be able to
close the page after this and know what happened.

### 2. Demote the theory
- The score-scale explainer becomes a disclosure ("How this is scored") or a tooltip on the
  scale, not body copy in the primary flow. Keep every word of it behind that affordance —
  it is genuinely good and genuinely not the first thing they need.
- Long narrative sections become a heading, a visual, and an expandable detail.
- Anything that repeats what the visual already says should go.

### 3. Per-competency, at a glance
Each competency should read as: name, score visual, the one-line verdict, and **the quoted
evidence** — with longer analysis collapsed. The quote is the most valuable thing on the
page and should be prominent, not buried in a paragraph.

### 4. Use the width
`max-w-3xl` forces a single column. Widen it and lay the summary out properly. Check 1280px,
1440px and 1920px, and do not regress mobile.

### 5. "What to do next" should be the most actionable thing on the page
Especially for a fresher, where task 048 already made the report tone instructive. Make that
visually prominent rather than a section near the bottom.

## Hard constraints — these are the product, not decoration

- **Never invent evidence.** Every claim stays tied to what the candidate actually said. No
  quote that was not said.
- **Never describe how anybody looked.** Nothing watches the candidate's camera. See
  `RoundMediaProperties.presenceWasObserved` and CLAUDE.md — a report claiming someone
  "maintained good eye contact" is fabricated evidence, the same failure as an invented quote.
- **Provenance stays visible.** Question sources and their tier are not clutter to be
  collapsed away into nothing; a general pattern must never read as a specific report.
- Do not change how anything is *scored*. This is a presentation task. If you find a scoring
  bug, report it, do not fix it here.
- Never encode meaning in colour alone.

## Don't reinvent the wheel

Check what a chart actually needs before adding a dependency. The project already rejected
d3/mermaid/react-flow for the course visuals in favour of hand-rolled SVG, and
`report-charts.tsx` is already hand-rolled and working. If you conclude a charting library
genuinely earns its place here, justify it in your report against what exists. Default to no
new dependency.

## Tests

- Behaviour and accessibility, not snapshots: disclosures are keyboard operable and labelled,
  expanded state is announced, heading order is sensible, contrast holds in both themes.
- A test that the evidence quote for a competency is present in the DOM (not hidden behind a
  disclosure) — the quote is the point.
- A test pinning that nothing renders a claim about the candidate's appearance.

## Verification

```bash
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build
```

Push the branch. Do not merge — the orchestrator merges on green CI.

**Report what a human must look at**, with a note on how to view a report locally if you
found a way that does not require a live interview (CLAUDE.md rule 7 forbids running one).
