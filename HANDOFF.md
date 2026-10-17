# Handoff — 17 October 2026

## Task

Remove the “Over to you” control from coding and system design rounds and let the interviewer take the next turn after the candidate stops answering (user request; no task file).

## What I built

- `apps/web/src/components/interview-room.tsx`: workspace answers now submit automatically after speech and visible editor or board activity settle. Removed the manual handoff control and updated the room copy.
- `apps/web/src/lib/silence.ts`: workspace turns require 8 seconds of quiet after speech and 12 seconds since the last editor or board change. Spoken-only rounds retain their 3.5-second window. The existing 10-minute workspace take limit remains a fallback.
- `apps/web/src/components/device-check.tsx`: preflight now explains automatic handoff for workspace rounds.
- Added behavior tests for coding, system design, pauses, continued work, and automatic submission.

## Assumptions I made

- A candidate needs to speak before silence can end an answer. Silent typing or drawing alone does not prove they have finished; the existing 10-minute guard still bounds the take.
- Editor and board changes are evidence that the candidate is still working. A longer workspace window is appropriate because quiet thinking is part of coding and design.

## What I could NOT verify

- Human judgement of whether the pause lengths feel natural in a live conversation. The previous in-app browser attempt could not enter the room because it exposed no microphone permission prompt; I did not claim a live voice-quality check here.
- Browser differences in microphone level and Excalidraw activity while a candidate draws. Tests exercise the room behavior with those signals mocked.

## Verification status

- Frontend typecheck, lint, all 3,082 tests and production build: pass. A first parallel test run timed out in an unrelated Arena test while the backend and build ran; a solo full rerun passed.
- Backend `ktlintCheck test build`: pass.
- [CI run 39023806409](https://github.com/softzenith-projects/Untiered/actions/runs/39023806409): web, API, database and image jobs all passed.
- No database migrations changed.

## Merge status

- Fast-forwarded and pushed `develop` at `6f0f6c0` after green CI. `main` was not changed.

## Suggested next task

- Try a coding and a system design answer in a browser with microphone access and tune the pause lengths from the observed pacing.

## Open questions for you

- None.
