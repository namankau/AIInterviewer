You are reading one document about how a company interviews, and pulling out the actual
interview questions it reports.

What the source says it is:
- Title: {{title}}
- Publisher: {{publisher}}
- Company this is meant to be about: {{company}}
- URL: {{url}}

The document:
{{content}}

## What to extract

Only questions the document actually reports as having been asked. For each one:

- `questionText` — the question as the source gives it. Tidy the grammar if it was
  transcribed badly; do not rewrite it into something more impressive.
- `companies` — every employer the document says asked this question, each named as the
  document names it. A question the author says came up at both Amazon and Microsoft
  lists both. When the document establishes the employer once for the whole account — a
  post about "my Amazon onsite" listing six questions — each of those questions lists
  Amazon. **An empty list when the document does not name an employer for it.** Do not
  fill it in from the company named above, from the URL or from the publisher: leave it
  empty and the system applies the source's company itself.
- Only ever a single, named employer. **Never a group or a category**: not "FAANG",
  "MAANG", "big tech", "Big Four", "product companies", "service-based companies",
  "startups", "MNCs" or "top tech companies". A question the document says is common
  "at FAANG" names no employer, so its list is empty. Never a guess, a placeholder
  ("Company X", "a large bank") or a description.
- Keep the employer the document names, not its parent or a sibling: "Google Cloud
  India" stays "Google Cloud India", and "AWS" stays "AWS".
- `roundType` — one of: `technical_fundamentals`, `project_deep_dive`, `coding_practical`,
  `system_design`, `case_client_scenario`, `techno_managerial`,
  `behavioural_competency`, `hr_fit_closing`. Null if the document does not make it clear.
- `seniority` — the level it was asked at, if stated. Null otherwise.
- `roleFamily` — the kind of role, if stated. Null otherwise.
- `askedOn` — the date it was reportedly asked, as `YYYY-MM-DD`. **Only if the document
  gives one.** A date is shown to candidates as evidence of how current this is, so a
  guessed one is worse than none. Null is the right answer far more often than not. If the
  document gives a month and a year ("March 2024"), use the first of that month. If it gives
  only a year ("in 2023"), leave it null — do not turn a year into 1 January.
- `notes` — one line on what the source says it was testing, or what a good answer covered.

## Process stages

Separately, pull out the interview **loop structure** the document describes at a named
employer — the stages, in order, that a candidate goes through. For each stage:

- `companies` — every employer the document says runs this stage, named exactly as it
  does. Same rules as above: empty list rather than a guess, never a group.
- `roleFamily` — the kind of role this loop is for, if stated. Null otherwise.
- `order` — its position in the loop, starting at 1, only if the document makes the
  order clear.
- `stageName` — the stage's name as the document gives it: "Online assessment",
  "Bar raiser", "Hiring manager round". Tidy the wording; do not invent a name it
  never uses.
- `format` — how it runs, if the document says (phone, onsite panel, take-home, panel
  of three). Null otherwise.
- `durationMinutes` — only if the document states a duration.
- `assesses` — one line on what the document says the stage is testing. Null otherwise.
- `roundType` — the same enum as above, or null for a stage this product does not
  simulate: an online assessment, team matching, or an offer conversation.
- `evidence` — **a verbatim quote from the document, roughly 25 to 300 characters**,
  that supports this stage existing. It must be copied exactly from the text above —
  not paraphrased, not reconstructed from memory — and it must be a real sentence or
  clause describing the stage, **never just the stage's own name repeated back**. A
  navigation menu that happens to list "System Design Interview" is not evidence that
  such a round runs; a sentence saying what it involves is. A stage whose evidence
  cannot be found verbatim in the document, or is too short to be more than a label,
  is discarded before it ever reaches a candidate.

Only stages the document actually describes as part of a real loop. A blog post's
generic "how to prepare for interviews" advice with no employer's actual process
behind it contributes no stages, even if it lists round types.

## Rules

- **Extract, do not generate.** If this document contains no actual reported questions,
  return an empty list. A plausible question you composed yourself is exactly what this
  whole pipeline exists to avoid — the candidate is going to be shown this alongside a
  link to this page, and if it is not on the page, we have lied to them.
- Do not include questions the document invents as examples or practice material unless
  it states they were actually asked. A list of questions that are "commonly asked",
  "popular", "worth preparing" or "asked in big tech" is advice, not a report that anyone
  asked them: leave every one of them out, even when the rest of the document is a real
  account of an interview.
- Do not infer the company from the URL or the publisher's name. Use what the text says.
- Ignore navigation, adverts, comment forms and cookie notices.

Return JSON matching the provided schema.
