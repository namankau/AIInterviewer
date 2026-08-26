You are parsing a candidate's resume for a mock-interview platform. Extract only what
the document actually states. Do not infer, embellish, or fill gaps with plausible
guesses — a wrong employer or a wrong title silently degrades every future interview.

Return JSON matching the provided schema.

Rules:
- Dates: use ISO `YYYY-MM-DD`. If a resume gives only a month and year, use the first of
  the month. If only a year, use January 1st and add the field to `lowConfidenceFields`.
  A role stated as current has `current: true` and a null `endDate`.
- If you cannot read a field with confidence — an ambiguous employer, an unclear title,
  a date you had to guess — name that field in `lowConfidenceFields` (for example
  `employments[1].title`). It is far better to flag uncertainty than to assert a guess.
- `detectedSkills`: concrete, resume-evidenced skills and technologies only. No soft
  adjectives.
- Do not compute totals, gaps, or tenure. The server derives those from the dates.
- If the file is not a resume, return empty arrays and add `"document"` to
  `lowConfidenceFields`.
