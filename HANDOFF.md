# Handoff — 2026-09-08 (evening)

## Task
A round sat and reported on: no interviewer voice, flattering scores, a report with no way
out, sign out in the wrong place, LinkedIn never populated, plus a request for live
candidate transcription, round deletion, report retention, report charts, and an
Internshala-style device check.

## What I built

- **Scoring is calibrated and it is measured.** `ai/prompts/report.md` carries an anchored
  scale — 2/5 is the default for a competent ordinary answer, 5/5 is reserved. A transcript
  written to be ordinary scored a median **70% before and 40% after**, three runs each
  against the live API. Strong rounds are placed honestly through `outcomeSimulation`
  rather than by inflating the number.
- **LinkedIn is parsed from the resume** (`LinkedInUrl.kt`, + schema and prompt). It was
  never extracted at all — the field could only ever be typed by hand, while sitting in the
  contact line of the document already uploaded. Validated hard: the parser is a model
  reading a PDF and returns "LinkedIn", personal sites and bare hostnames.
- **The report is in the app shell**, so there is a way back that is not "read to the end".
- **Sign out moved to the profile page**; the rail block is now the way in to it.
- **A missing voice says so.** Previously the round silently became a text one.

## What I could NOT verify

- **Voice, again.** The speech quota (100/day) was exhausted when your round ran, which is
  why the interviewer typed instead of speaking — I burned it benchmarking earlier the same
  day. It is still exhausted; the backchannel clips therefore still need re-rendering:
  `node --env-file=.env scripts/make-backchannel.mjs`.
- **The reference video** (`WhatsApp Video 2026-09-08 at 10.01.03 PM.mp4`) could not be
  decoded — the only ffmpeg on this machine is Playwright's minimal build, no H.264. Worked
  from the screenshots instead.

## Verification status
- typecheck / lint / tests / build: **pass** both sides. CI green before each merge.

## Merge status
- Merged into `develop` at `d104ad5`. Earlier today: `f3b6736`, `0cb23fd`, `5578f45`,
  `57bec1c`, `934fc58`.

## Suggested next task
Round deletion and 28-day report retention — **as a PR, not a merge.** `CLAUDE.md` routes
anything touching data deletion to human review, and this touches storage objects as well
as rows.

## Open questions for you

1. **The speech quota is now the product's biggest constraint, not a nice-to-have.** One
   question is one call against a 100/day project cap, so voice is off for part of every
   day and the round degrades to text. Needs billing enabled on the Google project. This
   has now broken a real round of yours.
2. **Live candidate transcription** needs the chunked-upload pipeline discussed earlier
   (recorder timeslice + an endpoint that accepts audio during the answer). It is the same
   change that removes the remaining upload latency and lets the interviewer notice when
   somebody has finished. Worth doing as one piece; say when.
3. **Report charts and the Internshala-style device check** are both still open. The device
   check exists (`device-check.tsx`) but is nothing like the reference.
4. `main` is ~60 commits behind `develop` and only you can advance it.
