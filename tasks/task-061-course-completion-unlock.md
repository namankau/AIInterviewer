# Task 061 — Course completion unlock

## Goal
Let a signed-in learner mark a chapter complete after visiting every guided lesson beat, with an explicit explanation while the action is locked and a recoverable save attempt when the initial progress read failed.

## Scope
- Track visited guided lesson beats in the existing client control.
- Place the completion action inside the guided lesson flow and unlock it after all beats are visited.
- Keep completed chapters undoable without forcing a learner to revisit every beat.
- Do not leave the action permanently disabled after a progress-read failure; preserve optimistic save/revert behavior and report write failure.
- Add focused behavior and accessibility tests.

## Out of scope
- Inferring mastery from quiz correctness.
- Offline/localStorage progress or changes to the account-backed progress API.
- Course-content rewrites.
