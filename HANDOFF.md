# Handoff — 2026-10-03 (loop brief, plan, stalls, spoken English, fresher option)

## Start here (for the next agent, Codex or Claude)
- Everything from this run is merged into `develop`. No branch is left open.
- **Migrations:** `20261003000000_answer_timing.sql` was applied at merge. The remote
  database matches local. Nothing is pending.
- **Untracked on purpose:** `.codex/` and `AGENTS.md`, which exist only on the owner's
  machine.
- Start new work from `origin/develop`. The next task file is 066.

## Task
Owner requests on 3 Oct, with no task file:
1. Never show the "we don't hold a sourced account" banner; fetch from the web or the AI
   instead.
2. The plan cards ignored what had been fetched about the employer.
3. Interviews of 20 minutes or more pause partway through.
4. A fresher / campus-placement option.
5. A spoken-English section in the report.

## What I built
1. **No unsourced-employer banner** (`fix/loop-brief-model-knowledge`, `9b0951a`), PRD §04.
   - Source order for the brief: our sourced record → web search → the model's own
     knowledge (`ModelEmployerKnowledge`, which reuses the pool's knowledge check) →
     archetype pattern.
   - Each section carries its own label instead of a banner.
2. **Plan from the employer's own rounds** (`fix/plan-from-employer-knowledge`, `cf4362c`).
   - The rounds the model names for an employer are mapped to round types by
     `StageRoundMatcher`.
   - The plan uses them in place of the archetype pattern and does not top them up with
     generic rounds.
   - Each card is labelled "as the AI knows it".
3. **Mid-round stalls** (`fix/interview-mid-round-stalls`, `3786bb5`).
   - Root cause: the hourly Supabase token refresh re-ran the room's load effect, which
     sent a live round back to the device check with the mic shut. The room now loads
     once per sign-in.
   - The primary model gets a 20s in-room deadline before the chain falls back
     (`InRoomDeadline`, `in-room-timeout`). Before, it could wait 3 minutes.
   - The next question waits at most 2s for the previous answer's audio upload
     (`attachAnswerAudio` links a late recording to its answer afterwards).
   - With the server-rendered voice, the floor now passes to the candidate 4s after the
     voice wait times out.
4. **Spoken English in the report** (`feat/spoken-english-report`, `9e14bcd`, with a
   migration).
   - The browser measures speech timing from the mic level (`speech-timing.ts`). The
     server checks it and computes the figures (`AnswerTiming.kt`, `SpokenEnglish.kt`):
     - words per minute against a stated rough range of 120–160;
     - pauses of 1s or more;
     - time to first word;
     - um/uh counts.
   - Model observations must quote the transcript. Any that state numbers or mention
     accent or pronunciation are dropped.
   - In Hindi-English rounds, English is not assessed.
   - UI: `spoken-english-panel.tsx`.
5. **Fresher / campus option** (`feat/fresher-campus-loop`).
   - A checkbox on the composer, "I am a fresher preparing for campus placement", sends
     `level=student|recent_graduate` to the brief and plan, and prefills the setup form.
   - A hand-written, archetype-level campus pattern (`CampusLoopPattern.kt`). It names no
     employer.
   - The plan drops system design, techno-managerial and client-scenario rounds for
     freshers.
   - `CampusRounds` covers gained SQL, shifts, higher studies and the spoken
     introduction.
   - Research: an open-source and official-page survey, kept in the run scratchpad and
     not committed. Most official campus pages could not be read, so no employer-specific
     campus detail was added.

## Assumptions I made
- "Never show this message" means the banner. Provenance stays as per-section labels
  (CLAUDE.md requires a tier on every piece of employer knowledge).
- Stall fixes: the 20s deadline applies only to the first provider; the 2s upload wait is
  a judgement call.
- Spoken English: a pause is silence of 1s or more between sounds; pace is measured from
  the first word to the last.
  - Pace and pauses are not measured in rounds with a code or drawing workspace.
  - Pronunciation and accent are never assessed.
- The fresher option is opt-in only, from the stated level. It does not change anyone who
  leaves it unchecked.

## What I could NOT verify (no live rounds, per rule 7)
- What the model actually says about Infosys, and why its web search came back empty.
- Whether the token-refresh fix is what removed the owner's pauses. One 20+ minute round
  on `develop` will tell. Also how often Gemini calls hang (search the logs for "did not
  answer … in time").
- Whether the speech threshold suits real microphones (noise suppression, quiet
  speakers), and whether Gemini follows the quote-only rule for observations.
- How the new UI looks: the composer checkbox, the spoken-English panel, and the "From AI
  knowledge" section.
- Known gaps:
  - The brief's AI-knowledge section is not level-aware, so it may still name a
    managerial round for a student. The plan is filtered.
  - An answer submitted after a laptop sleeps with an expired token is lost.

## Verification status
- Every branch passed typecheck, lint, test and build (web) and ktlintCheck, test and
  build (api), on CI and locally.
  - The spoken-English and fresher branches were re-run on CI after `develop` was merged
    into them.
- Flaky: `device-check.test.tsx` and one other web test failed once each under local
  load (while Gradle ran in parallel), then passed on rerun. CI never failed. Worth
  hardening.
- Size: the spoken-English change is about 2,000 lines, half of them tests. That is over
  the roughly 800-line guideline; capture and report could have been split.

## Merge status
- All five branches are merged into `develop`. The final merge is the fresher branch;
  see `git log`.

## Suggested next task
- A live 25-minute round on `develop` to confirm the stall fixes and the spoken-English
  figures. It spends money, so it is the owner's call.

## Open questions for you
- None.
