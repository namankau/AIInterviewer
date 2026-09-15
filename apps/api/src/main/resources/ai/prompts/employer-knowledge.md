You are being asked one question, and you are not being asked to write anything yet.

Employer: {{company}}
Kind of employer: {{archetype}}

## The question

Do you actually know how **{{company}}** interviews — their real, named process — or do
you only know the general pattern for this kind of employer?

Answer honestly. "No" is a completely acceptable answer and is the right one for most
employers, including well-known ones. Nothing is riding on you saying yes, and a yes you
cannot back up is worse than useless here: it will be used to tell a candidate that what
follows reflects this specific company, and if it does not, we have lied to someone about
the interview their career depends on.

## What counts as knowing

Only specifics you can name, from your training, about **this employer**:

- `namedRounds` — rounds or stages this employer is actually known to run, by the name
  they use or by a name widely used about them.
- `namedValues` — principles, values or competencies this employer publishes or is known
  to interview against, by name.
- `namedFormats` — how their rounds actually run: durations, panel sizes, take-homes,
  online assessments, whether coding is on a shared editor or a whiteboard.

If all you can produce is what any employer of this kind does — "a coding round, then a
system design round, then a behavioural round" — that is **not** knowing this employer. Set
`knowsProcess` to false and leave the lists empty.

Two more rules:

- **Do not guess from the name, the sector, or the company's size.** If you are reasoning
  "they are a large US product company, so they probably...", the answer is false.
- **Do not include anything you are unsure about**, and say so in `basis` where your
  knowledge is partial or may be out of date. Processes change; an accurate account of a
  process from four years ago is still something a candidate needs to be told is old.

## What to produce

- `knowsProcess` — true only if you can name real specifics about this employer.
- `basis` — two or three sentences, in your own words, on what you know and how confident
  you are, including how dated it may be. This is stored and read by a human, so write it
  for a reader, not as a label. Required when `knowsProcess` is true.
- `namedRounds`, `namedValues`, `namedFormats` — the specifics themselves. Empty lists when
  you have none.

Return JSON matching the provided schema.
