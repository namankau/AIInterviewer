# Handoff — 2026-09-09

## Task
Four items from the owner: live transcription of the candidate, round deletion plus report
retention, report visualisations, and an Internshala-style entry flow. Plus the interviewer
apologising for a question it was right to ask, and a question about speech cost.

## What I built

- **The browser speaks the questions** (`lib/browser-speech.ts`, `use-browser-voice.ts`).
  Answering the cost question: a modern browser voice is free, has no quota, starts in tens
  of milliseconds instead of six seconds, and reports a `boundary` event per word — so the
  text now follows the voice exactly rather than being paced against a recording's
  duration. `pickVoice` ranks what is available and only prefers local when the voice is a
  modern one. `speaksLocally` rides on the request and the server skips synthesis entirely.
- **Live transcript** (`use-live-transcript.ts`) — the candidate sees their words as they
  speak. Explicitly a mirror: it never reaches the server and nothing is scored against it.
- **Round deletion and 28-day retention** (`RoundDeletion.kt`, migration
  `20260908230000`). Deleting removes the session row; expiry keeps the row and clears the
  evidence, because history here is derived from completed sessions and dropping the row
  would rewrite how much practice somebody had done. Both purge storage by
  `{userId}/{sessionId}` prefix.
- **A pre-flight that actually tries the devices** (`device-check.tsx`) — staged checks
  that gate on each other, including speaking a line through the browser voice so the
  candidate hears the interviewer before the round. Only a blocked microphone stops entry.
- **The report's score, drawn as a scale** (`report-charts.tsx`) — named zones with the
  candidate's band marked, never a bar that is mostly empty. 40% is now an ordinary round,
  and a doughnut that is 60% empty would undo the recalibration in the first second.
- **Scoring recalibrated** (`ai/prompts/report.md`) — measured: the same ordinary
  transcript went from a median 70% to 40% over three runs each.
- **A challenged question is explained, not apologised for** (`QuestionText.kt`).

## Assumptions I made
- Agents ran sequentially, not in parallel: worktree isolation is refused in this repo
  (git resolves those paths outside the worktree), so concurrent agents would share one
  working tree and collide on git state and Gradle/Next build locks.
- The Internshala reference was applied to the interview entry flow only, not the whole
  app. Moving the whole app is a change to the documented design direction and is the
  owner's call — see Open questions.

## What I could NOT verify
- **Whether the browser voices exist on the owner's machine.** Chrome under Playwright
  never initialises its TTS controller, so `getVoices()` returned 0 in every configuration
  tried. The code detects at runtime and falls back; one real round settles it.
- **The reference video** could not be decoded — the only ffmpeg here is Playwright's
  minimal build, no H.264. Worked from the screenshots.
- Voice quality, and whether the pacing feels right — owner's call per CLAUDE.md.

## Verification status
- typecheck / lint / tests / build: **pass**. 103 frontend tests, backend green.
- CI green before every merge.

## Merge status
- All merged into `develop`: `6559a05` (visuals), `389d415` (capture comments), `ac7a304`
  (device check), `0ab060e` (deletion), `b604ece` (challenged question), `241e3cd`
  (browser speech).
- **Migration `20260908230000` applied to the linked project.** It was merged unapplied
  and broke the dashboard until caught — see the new ground rule 1.

## Suggested next task
Confirm the browser voice works on a real machine, then decide whether the whole app moves
to the Internshala register.

## Open questions for you
1. **The Gemini speech quota is 100/day** and has already turned a real round silent. The
   browser voice sidesteps it where a voice exists; billing on the Google project is still
   the only fix where one does not.
2. **Design direction.** "Boring" has been said three times, and CLAUDE.md codifies the
   opposite. Say the word and I will change the documented direction deliberately rather
   than let it drift.
3. `main` is ~70 commits behind `develop` and only you can advance it.
