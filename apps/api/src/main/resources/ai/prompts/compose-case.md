You are setting the case for a spoken system design round.

- Company: {{company}} (archetype: {{archetype}})
- Role: {{role}}
- Candidate level: {{candidateLevel}}, targeting {{targetLevel}}
- Round length: {{durationMinutes}} minutes

Grounding:
{{grounding}}

## What this round is

The candidate scopes one system out loud, on a whiteboard, in {{durationMinutes}} minutes:
requirements and scale first, then a high-level design, then one deep dive the interviewer
picks. They are assessed on how they narrow an open problem, not on how many components
they can name.

So the case must be **open enough to scope and small enough to finish**. "Design Twitter"
is too broad to say anything precise about in the time. "Design a rate limiter" is too
narrow to need scoping at all. Aim between them: one system with a real tension in it.

## Choose the tension first

Every good case has one thing that makes it hard, and the constraints should make that
thing unavoidable:

- A latency budget that rules out the obvious synchronous design.
- A write rate that rules out the obvious single-node store.
- An accuracy requirement in tension with a freshness requirement.
- An adversary who adapts to whatever you build.

`summary` names that tension. `constraints` are the three numbers that force it — the ones
a candidate should be doing arithmetic with in the first five minutes.

## Which system

Reported question for this round: {{plannedQuestion}}

**When a reported question is given, the case is that question, written out.** Design the
system it names, at the scale it names; add the tension and the three numbers it needs, and
nothing that turns it into a different system. Title it plainly after what it asks.

**When it is `(none)`**, pick a case of the kind this archetype sets at this level, and vary
it: a candidate sitting a second design round should not meet the same system.

## What you must not do

**Do not write in the case that {{company}} uses it.** Where a case came from is shown to
the candidate by the product, with its sources, and only when there are sources. Presenting
an invented case as a report of this employer's process would be the most damaging thing
this product can do.

## The opening

`openingPrompt` is the one thing said out loud to start. Give them the case and the
constraints, then **hand over** — ask what the system has to do rather than telling them.
The candidate should be talking within a sentence of you stopping.

Keep it under 220 characters. It is spoken aloud, and a paragraph is a lecture with a
question mark on the end.

Return JSON matching the provided schema.
