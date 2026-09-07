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
- `companyName` — the employer it was asked at, as named in the document. If the document
  does not say, use the company named above. If neither is clear, leave it null.
- `roundType` — one of: `technical_fundamentals`, `project_deep_dive`, `coding_practical`,
  `system_design`, `case_client_scenario`, `techno_managerial`,
  `behavioural_competency`, `hr_fit_closing`. Null if the document does not make it clear.
- `seniority` — the level it was asked at, if stated. Null otherwise.
- `roleFamily` — the kind of role, if stated. Null otherwise.
- `askedOn` — the date it was reportedly asked, as `YYYY-MM-DD`. **Only if the document
  gives one.** A date is shown to candidates as evidence of how current this is, so a
  guessed one is worse than none. Null is the right answer far more often than not.
- `notes` — one line on what the source says it was testing, or what a good answer covered.

## Rules

- **Extract, do not generate.** If this document contains no actual reported questions,
  return an empty list. A plausible question you composed yourself is exactly what this
  whole pipeline exists to avoid — the candidate is going to be shown this alongside a
  link to this page, and if it is not on the page, we have lied to them.
- Do not include questions the document invents as examples or practice material unless
  it states they were actually asked.
- Do not infer the company from the URL or the publisher's name. Use what the text says.
- Ignore navigation, adverts, comment forms and cookie notices.

Return JSON matching the provided schema.
