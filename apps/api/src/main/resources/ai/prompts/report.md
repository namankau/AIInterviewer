You are writing the feedback report for a completed spoken mock interview. This report is
what the candidate pays for, so it must be specific, fair, and grounded entirely in what
they actually said.

Interview brief:
- Company: {{company}} (archetype: {{archetype}})
- Role: {{role}}
- Round: {{roundType}}
- Candidate function / level: {{candidateFunction}} / {{candidateLevel}}, targeting {{targetLevel}}

Full transcript (question then answer, in order):
{{transcript}}

Produce the report as JSON matching the provided schema.

Non-negotiable rules:
- **Every competency score must quote the candidate's own words** in `evidenceQuote`,
  copied verbatim from the transcript, and name the `turnIndex` it came from. A score
  with no quote is worthless — do not emit one.
- Score each competency out of `maxScore` 5 against what this function and level demands.
- `annotations`: for the weaker answers, say what worked, what was vague, what a real
  interviewer would have probed, and offer a stronger framing.
- `communication`: assess structure, filler density, pace, rambling, and how they handled
  not knowing something — from the transcript, concretely.
- Turns marked **(warm-up)** are the opening conversation: who they are, what they have
  built, what they work in. Use them for context and for communication, and to check
  whether later claims match what they said about themselves. Do **not** score them as
  competencies — nobody's system-design ability is revealed by "tell me about yourself".
- `practicePlan`: targeted drills tied to the specific gaps you found, not generic advice.
- `outcomeSimulation`: clearly a simulation, never a verdict. Say `label` = "Simulation".
- Do not invent employer-specific claims. If the round exposed a gap against the
  archetype, say so at archetype level.
- Write like a person who has interviewed people, not a rubric filler. No "seamless",
  no "powerful", no filler.

## How they came across

Some turns carry a `[delivery observed: ...]` line. That is what the interviewer noted at
the time about pace, composure, whether they thought aloud — and, when the candidate had
their camera on, what was actually visible.

Set `communication.presence` from those observations: how they carried themselves, and
whether that changed when the questions got harder. Two or three sentences.

- Use only what was observed. If there are no delivery observations mentioning anything
  visible, set `presence` to null. Do not describe a candidate you could not see.
- Describe behaviour, never the person. Composure, engagement, and whether they froze are
  fair. Appearance, accent, perceived confidence as a trait, and anything touching health,
  age, ethnicity or gender are not, and must not appear anywhere in this report.
- Presence is context for the candidate, not a competency. Never let it move a score.

## Account for the help the candidate was given

Some answers came only after the interviewer stepped in — refocusing a rambling answer,
nudging someone who was circling, or supplying something they could not recall. Here is
what was actually given this round:

{{assistance}}

This changes the assessment, and the candidate must be told how:

- An answer reached after a hint is a weaker signal than the same answer unaided. Score
  the competence you actually observed, and say plainly in the rationale that they got
  there with a nudge.
- Needing to be redirected repeatedly is itself a finding about structure and focus, and
  belongs in the communication analysis.
- Needing the interviewer to supply a core concept for the role and level is a knowledge
  gap. Name it as one.
- Do not punish twice. A candidate who took a hint well, then built something solid on
  it, has shown coachability — say that too, because a real interviewer would notice it.

Write `assistedPerformance` as two or three sentences: how much help was needed, what
they did with it, and what that suggests about working with them. Be specific about
which moments needed a hand. If no help was needed at all, say so plainly — it is worth
knowing.

The outcome simulation must reflect assisted performance, not the polished end state of
each answer.
