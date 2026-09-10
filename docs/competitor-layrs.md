# Layrs (layrs.me) — what they built, and what we take from it

Researched 2 September 2026 from the public site: rendered pages, the client bundles
behind the authenticated routes, the stylesheet, and the sitemap. No account was created
and nothing was logged into — the notes below come from public assets.

## What the product is

**"A voice-first AI tutor for engineers."** Bangalore, small remote team, in beta,
founder pricing. Positioning line from their about page: *"We're building a tutor that
notices when you're bluffing."*

The core loop is a spoken lesson: you talk through a concept while drawing on a live
canvas, and the tutor watches the canvas and interrupts when you hand-wave. After the
session it reports which concepts held up and which you glossed, and reshapes the
roadmap. A curriculum generator researches a topic, maps prerequisites and sequences
lessons.

Mock interviews are a **recent addition** to that tutor, marked NEW in their nav.

## Information architecture

Left rail, persistent: Home · Plans · My courses · Progress · Library · Interviews (NEW)
· Sessions, with "New session" pinned at the top and "Upgrade to Pro" at the bottom.
Breadcrumb under the header (`home / library`).

## The library page — the one the owner pointed at

Editorial, not a feature grid:

- Serif display heading, set large, with a full stop: **"The library."**
- One line of subtitle: *"Curated tracks for senior engineers. Hand-picked topics,
  structured for depth."*
- A filter row: `All tracks · 4` and `Sort: Most popular`.
- A vertical list of four cards — not three columns of identical icon tiles. Each card
  is a small uppercase eyebrow (`SYSTEM DESIGN`), a `LIVE` badge, a title, one
  **concrete** sentence, and a meta line.

The copy carries the whole thing, because it is specific:

> **System design interviews** — Sharding, hot keys, cache layers, and what simple
> actually costs at planetary scale. · *312 engineers in this track*

> **AI system design** — RAG, agents, evals, inference serving, and the token economics
> interviewers now grade as hard as the diagram. · *New · 25 case studies*

Footer of the list: *"Want a different track? Request one."*

This is the standard our own list pages should meet. It is the same standard `CLAUDE.md`
already sets — real nouns beat adjectives — executed well.

## A track page (system design)

45 units, 24 case studies, *"Read half. Design half."* — an explicit 50/50 learn/practice
split. Six modules (Core Concepts, Key Technologies, Common Patterns, The Delivery
Method, Leadership Altitude), each with a "Tutor tour".

**Band-level personas** run through everything: Junior, Mid, Senior, Staff/Architect,
Manager. The page is *"tuned for Mid"*, and switching to Senior changes the
learn:practice ratio (Senior 25:75, Staff 15:85) and unlocks the next tier of cases.
Cases are tiered T1–T4 with real durations — T1 junior: URL shortener, pastebin, rate
limiter (25–35 min); T3 senior: ride-hailing, video streaming, payment system (45–55
min), labelled *"above your band"*.

**Worth stealing:** band level is a first-class dimension that changes the content, and
the interface says plainly when you are working above your band.

## The interviews feature

Reconstructed from `app/(app)/interviews/page-*.js` and `interviews/room/[type]/page-*.js`.

### Loops

A **loop** is a whole onsite: several rounds against one company at one level, with a
real onsite date. *"Tell the composer where you're headed — company, level, onsite date —
and your readiness gets tracked against it."* Loops show a days-left countdown and a
readiness label. Rounds can also be taken as **singles**, unattached: *"or take a single
round — the round itself is free."*

Round types: `dsa`, `system_design`, `lld`, `behavioral`, plus machine coding.

### The composer

A single free-text box. Placeholder examples rotate through real sentences:

> *"Google L4 onsite in six weeks — I haven't interviewed in four years."*
>
> *"Meta E5 onsite, Aug 20. Product design heavy — and I'm rusty on estimation."*

Sold as: *"Say it in one line. The round, company style, and bar get set for you."*
There is also **"Set it up by voice"**.

Parsing shows its work — *"Reading your query… Working out the company, level and round
type from what you wrote"* — then a confidence and a chip set you can edit.

### Honesty about what they know

This is the part they get right and we should match. They run about a minute of live
research on the company's real loop, show **sources with URLs**, and if it fails:

> *"We only draft loops we can verify, so we won't hand you a made-up [loop]."*
>
> *"First time anyone's asked about [company]. Here's what we did check: …"*

with an explicit opt-in to *"Practice a generic FAANG-style loop instead"*, captioned
*"close enough to practice against — just not this company"*.

Our `ArchetypeResolver` already refuses to fabricate. What we do not do is **show the
candidate what we checked**.

### The room

Entering a round is an antechamber, not a door. States: *"Checking your microphone"* →
*"Waiting on the microphone prompt / Your browser is still asking. Answer it and this
flips to ready — or enter anyway and sort it from the room."* → **"Enter the room"**.
Copy sets expectations first: *"Your browser will ask for permission — this round is
spoken."*

Four things they promise about a round:

| Promise | What it means |
|---|---|
| Timed phases | The round has a shape and a clock |
| Real hints, on your record | You may ask for help; it counts against you |
| Spoken debrief at the end | The round ends in a voice, not a redirect |
| Committee report | A verdict that reads the whole loop together |

## Pricing (INR, from `/pricing`)

| Tier | Price | Voice minutes | Session cap |
|---|---|---|---|
| Free | ₹0 | 30/week | 30 min |
| Pro | ₹1,499/mo | 3,600/mo | 120 min |
| Yearly | ₹14,999/yr (≈₹1,250/mo) | 5,040/mo | 120 min |
| Interview Sprint | ₹3,999 / 3 months | 4,320/mo | 120 min |

The **Interview Sprint** is the interesting one: prepaid, no auto-renew, explicitly
shaped to a 6–10 week interview run. That matches how candidates actually buy — a burst
around a job hunt, not a subscription — and it is a pricing idea worth putting to the
owner.

Note what is *not* metered: interviews. They meter **voice minutes**. Our free tier is
one complete interview. Theirs is 30 voice minutes a week, which is roughly one short
round — comparable, but it renews.

## Their visual system

Taken from their stylesheet.

- **Warm paper, not white.** Light: `#fbf7f4` → `#f4efe8` → `#ece6dc` → `#dfd8cb`.
  Dark: `#0b0c11` → `#111219` → `#181a23` → `#20232e`. Ink `#0b0c11` / `#f1efec`.
- **Hairlines at 8% opacity** (`#0b0c1114`), never a heavy border.
- **A serif display face** for headings against a system sans for UI and a mono for
  numbers. This is most of why it reads as editorial rather than as a SaaS template.
- Radii 4 / 8 / 12 / 20 / 28. Shadows are almost nothing — `0 1px 2px` plus a wide, very
  soft `0 12px 40px` at 6% — a page lift, not a card drop shadow.
- Accent: a cyan→blue→violet gradient (`#04e0fa → #1b2bf2 → #6035ff`).

**We take the warm ground, the hairlines, the serif display and the flat surfaces. We do
not take the gradient** — `CLAUDE.md` names purple-to-blue gradients as a tell, and one
restrained accent used for meaning is a decision already made here.

## Where they are weak, and we are not

1. **They serve one candidate.** SDE-1 to Staff, FAANG and high-bar startups, system
   design and DSA. No service-based IT, no Big Four case round, no European competency
   round, no HR/notice/relocation conversation, no non-engineering function, no
   Hindi-English. That is our entire stated differentiator and they have not touched it.
2. **No camera.** Their rounds are voice and a canvas. Delivery — how you came across —
   is not assessed. We record video under separate consent and already judge presence.
3. **No resume.** Nothing personalises a round to the candidate's actual projects. Our
   project deep-dive round is built for exactly that (still unbuilt — see `HANDOFF.md`).
4. **Tutor first, interview second.** Their interview feature is new and grafted onto a
   learning product. Ours is the product.

## What this task takes

Latency, the device-check antechamber, the asked-for hint, the one-line composer, the
editorial shell and catalogue, and the spoken debrief. Loops and live-research sources
are flagged to the owner rather than built — see `HANDOFF.md`.
