# Handoff — 2026-09-08

## Task
Three faults reported from a real session: the pause between questions, questions about
the wrong job, and the acknowledgement clips sounding like a different person.

## What I built

Measured the turn against the live API before changing anything, which redirected the
whole fix. **The model call was never the bottleneck.**

| stage | before | after |
|---|---|---|
| answer → question text | 4.7s | 3.5s |
| question → speech | 15.6s | ~6s (see "could not verify") |
| median question | 166 chars | 74 chars |

- `ai/schemas/assess-answer.json` — `maxLength: 120` on `nextQuestionText`. Speech latency
  scales with length (measured: 48 chars 5.2s, 83 chars 6.1s, 220 chars 15.6s) and the
  interviewer was writing 166-character questions that restated the answer before asking
  anything. **Prompting had failed at this four times**; a fifth attempt with an explicit
  30-word budget moved the median from 133 to 141 characters. The schema moved it to 74,
  and the model rephrases to fit rather than being truncated.
- `ai/schemas/opening-question.json` — same, at 220.
- `ai/prompts/opening-question.md` — removed a contradiction it had carried all along: it
  asked for "roughly thirty seconds of speech" and "two sentences at the outside" in the
  same breath. Thirty seconds of speech is ~26s of synthesis before the candidate hears
  anything, which is the "stuck starting the interview" complaint.
- `ai/prompts/assess-answer.md` — separated two rules it had been conflating. A verdict on
  the answer ("That's a great overview") stays banned. Briefly pointing at what they said
  ("You mentioned some lag at peak — how did you address that?") is now explicitly fine.
- `ai/SpeechChunks.kt` — only text of 200+ characters is fanned out into parallel calls.
  Concurrency has a tail: four parallel calls returned a straggler at 11.0s against 5.1s
  for its siblings, and one chunk came back at 34.7s against a 5.5s median. The candidate
  waits for the slowest chunk, so below 200 characters one call is faster *and* steadier.
- `resume/ResumeService.kt` — roles sorted most-recent-first, current role marked
  `<- CURRENT ROLE`, and the prompt told to anchor there. This is the wrong-job bug: the
  list went to the model in page-layout order with nothing saying which job was current.
- `scripts/make-backchannel.mjs` — renders bare, the same request shape
  `GeminiInterviewAi.synthesizeSpeech` sends.

## Assumptions I made

- **A short restatement is good interviewing, not a defect.** Stripping "You mentioned
  some lag at peak." from a 76-character question leaves "How did you address that?" with
  a dangling "that". The length was the problem, not the pointer.
- **Kept the schema field order.** Generating the question before the transcript showed no
  latency gain (3.61s vs 4.70s was run-to-run noise) and would have the model ask before
  it has listened. Not worth the quality risk.
- Left video in the in-room model call rather than removing it — see below.

## What I could NOT verify

- **Speech, at all.** The TTS model has a **100 requests/day project quota** and I
  exhausted it benchmarking. The 3.5s assess figure and the 74-character questions are
  measured; the ~6s speech figure is computed from the length/latency curve, not observed
  after the change. Re-run `node --env-file=.env scripts/e2e/interview.mjs` once it resets.
- **The acknowledgement clips are still the old recordings.** The script is fixed; the
  clips need re-rendering and that needs the quota:
  `node --env-file=.env scripts/make-backchannel.mjs`. Until that runs, the voice still
  mismatches.
- Whether ~9.5s *feels* acceptable. It is half of what it was, but it is not a
  conversation. Only you can judge that.

## Verification status
- typecheck / lint / tests / build: **pass**, both jobs, CI run `34228936441`.
- Live API: assess 3.5s over 4 runs; questions 51, 72, 76, 132 chars (`maxLength` is a
  strong steer, not a hard cap).

## Merge status
- Merged into `develop` at `62afd7c`. Branch `fix/017-turn-latency` deleted local + remote.

## Suggested next task
Take video off the answer's critical path. The browser posts audio *and* video in one
multipart request, so the model call cannot start until a multi-megabyte upload finishes —
on a home uplink that is seconds, every turn. `CLAUDE.md` says body-language analysis is
"capture it now, analyse it later", so uploading it separately costs nothing that is
currently used.

## Open questions for you

1. **The 100/day speech quota is a launch blocker.** One question is one call, so the free
   tier is roughly ten interviews a day across all users — and when it runs out, rounds
   silently fall back to text with no voice. Needs a paid tier on the Google project
   before the link goes anywhere public.
2. **~9.5s is the floor without a realtime vendor.** The remaining levers are streaming
   the assessment so speech starts ~1.5s earlier, and then LiveKit / Pipecat / Gemini
   Live. The latter commits real spend and `CLAUDE.md` reserves it for you.
3. `main` is ~54 commits behind `develop` and only you can advance it.
