# Handoff — 7 September 2026

## Read this first

**The Gemini project has hit its monthly spend cap.** Every model call now returns 429
`RESOURCE_EXHAUSTED`. Raise it at https://ai.studio/spend — nothing else is wrong, and
nothing in the code needs changing. Tonight's benchmarking and live runs used it up.

Until it is raised: interviews will fail to start, reports will not compose, and the
source library will not extract. The failure paths all behave correctly (sessions are
marked `failed` rather than faked), and the 429 now says explicitly that it is billing
rather than a bug — that was worth fixing when I hit it.

## Task

Six things you asked for. Four are merged into `develop`, one is a PR waiting on you, and
two are not built.

## What is merged

### The room no longer feels like dictating into a void

A real interviewer makes noises while you talk. Four short clips ("mm-hm", "right",
"okay", "mm") now drop into pauses, and one longer one ("okay, let me think about that")
plays the instant you stop, while the model is still reading your answer. That last one
does the most work: it turns a dead gap into someone who heard you.

Clips are rendered ahead of time and committed (`scripts/make-backchannel.mjs`). A
backchannel that arrives after a round trip to a model is not a backchannel.

The silence detector stops trusting its meter while a clip plays. Echo cancellation
*should* keep our own voice out of the microphone, but "should" is not a basis for
deciding that somebody has stopped speaking.

### Text now waits for the voice

The question is revealed in step with the audio reading it, paced by position in the clip
since Gemini gives no word timings.

**The interesting part is what did not work.** I first gave the voice a 6-second head
start. That made things worse, and the measurement is why:

| | before | now |
|---|---|---|
| answer → next question, in writing | ~24s originally, ~7s last week | **3.6s** |
| answer → voice ready | 17.7s | **14s** |

Speech latency is the model's, not ours — about 5s for a sentence and 14s for a
paragraph. I split questions into parallel per-sentence calls (`SpeechChunks`), which took
17.7s to 14s and no further. So a short window would have put text on screen at 6s and had
the voice read it out at 14s: exactly the mismatch you complained about. The room now
waits for the voice and covers the wait honestly, falling back to written text only when
speech genuinely failed.

**This is the biggest thing still wrong with the room, and it is a vendor limit.** Getting
the voice under ~5s needs either a faster TTS or the realtime path (`CLAUDE.md` lists
LiveKit/Pipecat as undecided). That is a spend decision, so it is yours.

### The interviewer stopped paying for thinking it was not using

Measured against live Gemini, three runs each, on a real assessment:

| thinking budget | latency | still challenged a weak answer |
|---|---|---|
| unbounded | 7.1s | yes |
| 256 | 3.0s | yes |
| 0 | 1.8s | yes |

Thinking was not buying quality. Every budget pushed back on *"it was mostly fine, nobody
complained much"*, and the unbounded one was not the sharpest of them. So the calls you
sit in silence waiting for — the question, the follow-up, a hint — no longer pay for it.
The report keeps unbounded thinking: nobody is waiting on it, and it is what people came
for.

I also dropped the per-turn `summary`, `strengths` and `gaps` fields, which were written
to the database on every turn and read by nothing.

### Dev indicators are off

The "Static Route / prerendered at build time" card was Next's dev overlay. It only ever
rendered in development, but development is where you look at the product, and a
floating framework badge over a live interview reads as somebody's half-finished project.

### Counting

`GET /api/v1/usage` — two aggregate integers, unauthenticated, rendered server-side into
the landing page. Counted from the rows on every request rather than incremented
somewhere, because a running total drifts from the thing it counts and this one is shown
to strangers.

The line only renders above 25 interviews. "3 interviews completed" is worse than no
number at all.

## What is waiting on you: PR #3, the source library

<https://github.com/namankau/AIInterviewer/pull/3>

**A PR rather than a merge because it introduces an admin role**, and `CLAUDE.md` requires
that for anything touching permissions.

Somewhere to put documents and links about how named employers actually interview,
re-read every 7 days, with extracted questions carrying the source they came from. A round
for an employer we hold sources on is grounded in them, and its report cites documents the
candidate can open. This is the other half of the provenance work from the last run — the
`published_source` tier now has a way to be earned.

**The part to review carefully is that it fetches URLs.** `CLAUDE.md` puts bulk scraping
out of scope, so the line is enforced in code rather than promised:

- Only URLs somebody explicitly added are fetched. Nothing is discovered.
- **Links on a fetched page are never followed.** That one rule is the whole difference
  between reading a document and crawling a site.
- robots.txt is honoured per fetch, and a disallow is permanent.
- A real User-Agent that says who we are, one request at a time.
- `RobotsRules` errs towards *not* fetching. Nine tests cover the awkward cases.

Set `ADMIN_EMAILS` to enable it. Unset denies everyone, which is the right default for a
list that gates writes.

## What I did NOT build

Two of your six, and I would rather say so than half-do them:

1. **Sign in with LinkedIn.** Still Google-only. Supabase supports `linkedin_oidc`; it
   needs an app registered on LinkedIn and the client ID/secret in the Supabase dashboard,
   which is yours to do — then the button is a small change.
2. **Profile: resume, LinkedIn URL, photo, role, skills.** Not started. The `profiles`,
   `resumes` and `skills` tables have existed since task 001 and are still empty of
   behaviour.

**Resume upload is the one I would do next, and it is not close.** Without it the project
deep-dive round is generic, which is the difference you are selling. It has been the top
item in two consecutive handoffs now.

## Assumptions I made

- **Backchannel clips are committed as WAV** rather than synthesised per session. They
  never change, there are seven, and they total a few tens of kilobytes.
- **Company matching in the source library is exact, case aside.** Google's questions are
  not evidence about Google Cloud India.
- **Admin is an email allow-list in config**, not a role column. Write access to the
  library changes what the product asserts about real companies, so it should not be
  grantable through a bug in a profile endpoint.
- **A 6-second voice grace became 25 seconds** once I had measured the speech latency. See
  above — the short window was actively worse.

## What I could not verify

- **Source extraction against a live document.** Spend cap. The fetch, the robots check
  and the admin gate were all verified; only the model call was not.
- **The backchannel in a real browser.** The clips play through `Audio()` and the silence
  detector pauses while they do, but I have not sat in a round and listened. The
  browser-only failure mode to watch for is our own voice leaking into the microphone
  despite echo cancellation — if answers stop ending themselves, that is why.
- **Whether the 14-second wait for the voice actually feels acceptable.** I think it is
  better than text-then-voice. You should judge it.

## Verification status

| Check | Result |
|---|---|
| `npm run typecheck / lint / test / build` | pass — 47 tests |
| `./gradlew ktlintCheck test build` | pass |
| CI | green: 34148154481, 34148411886, 34149636393 |
| Live turn latency, measured | 3.6s to question text, 14s to voice |

## Merge status

- `fix/011-room-presence` → merged into `develop` (`6b6a998`)
- `feat/012-usage-counters` → merged into `develop` (`93fde95`)
- `feat/013-source-library` → **PR #3**, open, CI green

## Suggested next task

Resume upload and parsing. Third time of asking.

## Open questions for you

1. **Raise the Gemini spend cap**, or the product is down.
2. **Is 14 seconds of "let me think about that" acceptable?** If not, the realtime voice
   vendor decision comes forward, and that commits real spend.
3. **Nothing caps model spend per account.** Rounds are unlimited and free. That is right
   for now, but it wants a ceiling before the link goes anywhere public.
