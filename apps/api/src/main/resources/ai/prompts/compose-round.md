A candidate has described, in their own words, the interview they are preparing for.
Turn it into the setup for one mock round.

What they wrote:
{{query}}

## What you are deciding

**company** — the employer, as they would write it on an application. Normalise obvious
shorthand ("goog" → "Google", "tcs" → "TCS", "amzn" → "Amazon"). If they did not name an
employer at all, leave it empty. Do not guess one from the role, the technology, or the
country.

**role** — the job title, as a posting would word it. Turn a level into a title when they
gave one ("L4 at Google" → "Software Engineer", "E5" → "Senior Software Engineer", "SDE
II" → "Software Development Engineer II"). If they described work rather than a title
("I do data pipelines"), write the title that work is usually posted under. If there is
nothing to go on, leave it empty.

**level** — the seniority they are targeting, in their own terms where they used one
("L4", "E5", "SDE II", "senior", "lead", "fresher"). Empty if they did not say.

**roundType** — exactly one of:

- `technical_fundamentals` — concept depth. "Core Java", "DBMS round", "fundamentals".
- `project_deep_dive` — their own work, interrogated. "They'll ask about my project",
  "resume-based round". **This is the default when nothing else clearly fits and they
  have work experience.**
- `coding_practical` — DSA, algorithms, machine coding, "DSA round", "LeetCode".
- `system_design` — "system design", "HLD", "design round", "architecture".
- `case_client_scenario` — consulting cases, client situations, "case round",
  "guesstimate".
- `techno_managerial` — delivery, estimation, escalation. Common as an "MR round" or
  "techno-managerial round" at Indian service companies.
- `behavioural_competency` — "behavioural", "STAR", "leadership principles", "values fit",
  European competency rounds.
- `hr_fit_closing` — notice period, compensation, relocation, visa. "HR round".

**durationMinutes** — how long they said the round runs, if they said. Otherwise leave it
null and the server picks a realistic length. Never invent a number from the company.

**language** — `hindi_english` only if they wrote in Hindi, used Hinglish, or asked for
it. Otherwise `english`.

**understood** — one short sentence, addressed to them, saying what you took from what
they wrote. Plain and specific: "A system design round for a Senior Backend Engineer role
at Adyen." Not "I have understood your requirements."

**assumptions** — the things you filled in that they did not say, one short phrase each,
each written so they can tell at a glance whether to correct it. "Assumed a 40-minute
round", "Read 'MR round' as techno-managerial", "Guessed Software Engineer from L4". Empty
when you genuinely inferred nothing.

**confidence** — `high` when they named an employer and the round type was explicit or
unmistakable. `medium` when you inferred one of the two from clear context. `low` when
you are largely guessing, or when they gave you almost nothing.

## Rules

- **You are reading their sentence, not researching their employer.** Never add a claim
  about how a company's process works, how many rounds it has, or what it asks. That is
  decided elsewhere, from the archetype, and inventing it here is the most damaging thing
  this product can do.
- An empty company is a fine answer. The round still runs; it runs on general patterns and
  the candidate is told so. A guessed company is worse than none, because it silently
  changes the round they get.
- If what they wrote is not about an interview at all, set confidence `low`, leave company
  and role empty, and say so in `understood`.

Return JSON matching the provided schema.
