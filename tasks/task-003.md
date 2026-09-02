# Task 003 — close the experience gap with Layrs

Autonomous run, 2 September 2026. Research artefact: `docs/competitor-layrs.md`.

## Why this task exists

The owner pointed at https://layrs.me/library and said "this is how I want my site to
be — a real competitor. Understand what they do, then do the same or better."

Layrs is a **voice-first AI tutor for engineers** (Bangalore, beta) that has recently
added mock interviews. It is not the same product as ours — it teaches system design and
DSA through spoken lessons with a whiteboard-watching tutor, and its interview feature
is an extension of that. But the *experience* is ahead of ours in four specific ways,
and those four are what this task closes.

## What Layrs does better, concretely

1. **Setup is one sentence, not a form.** Their composer takes free text — *"Google L4
   onsite in six weeks — I haven't interviewed in four years"* — and derives company,
   level, round type and bar. We ask for four fields in four widgets.
2. **The room is real-time.** They sell voice minutes; speech is continuous. Our turn
   costs **~24 s** between the candidate finishing and hearing the next question, which
   the previous handoff already named as the single biggest quality problem.
3. **Entering a round is gated on a working microphone.** They check the device, show
   the permission state, and only then offer "Enter the room". We drop the candidate
   into a live round and find out about a dead mic afterwards.
4. **Help is offered and recorded.** "Real hints, on your record." We record
   interventions the interviewer *chooses* to make, but a candidate who is stuck has no
   way to ask, so they stall in silence instead.

Two more we should note but not copy tonight:

- **Loops.** A whole onsite — several rounds against one company, level and a real
  onsite date, with a days-left countdown and a committee-style debrief that reads every
  round together. This is their strongest idea and our biggest gap. It also collides
  with a settled architectural rule (`CLAUDE.md`: no stored target list). **Owner's
  call — see HANDOFF.** Not built tonight.
- **Live research with sources.** They research a company's real loop and show the URLs,
  and refuse to draft one they cannot verify. We already refuse to fabricate, via
  `ArchetypeResolver` confidence — but we tell the candidate less than they do.

## What NOT to take

Their accent is a cyan→blue→violet gradient. `CLAUDE.md` names purple-to-blue gradients
as a tell to avoid, and that decision is settled. We take their warm-paper ground, their
serif display face and their editorial list layouts; we keep our single blue accent.

## Scope, in merge order

Each is its own branch, verified and merged into `develop` separately, so a failure late
in the night does not cost the work done early.

- **003 — turn latency.** Speech generation comes off the critical path. The next
  question's text returns as soon as it exists; audio arrives after. Target: the
  candidate can begin answering in under half the current wait.
- **004 — the room.** Device check before entry, the round clock, an answer that ends
  itself on silence, a question the candidate can replay, and a hint they can ask for.
- **005 — the composer.** One line of intent, parsed server-side into the round, shown
  back for correction before anything starts.
- **006 — shell and catalogue.** The app shell Layrs' library page has, and an
  SSR catalogue of the rounds we run — organic search is a primary channel (PRD 11).
- **007 — spoken debrief.** The round ends in the interviewer's voice, not a redirect.

## Verification

Every branch: `npm run typecheck && lint && test && build`, `./gradlew ktlintCheck test
build`, CI green via `gh run watch` before merge. Plus an end-to-end run against the
live API and a real test user, because the last run's "verified end to end" meant end to
end *of the server* and three browser-only bugs slipped through.
