# Proof-of-progress public page: information architecture prototype

**Status:** Review artifact only

**Date:** 2026-10-05

**Parent decision:** [`proof-of-progress-product-decision.md`](./proof-of-progress-product-decision.md)

## Scope and boundary

This prototype tests whether a visitor can quickly understand what a learner completed
without mistaking completion for certification or exposing private interview data. It is
an unlinked frontend component populated only with synthetic data. It does not add a
route, persistence, authentication, public-link discovery, publishing controls, or any
path from a real user record to the page.

Those omissions are deliberate. Phase 1 remains blocked on the human-reviewed visibility,
threat, retention, and account-deletion design required by the parent decision.

## Visitor's question

The page should answer one question in under a minute:

> What did this learner finish on InterviewOS, and what did each activity cover?

It must not answer adjacent questions that the product cannot support honestly, such as
how the learner ranks, whether they have mastered a skill, or how an employer assessed
them.

## Page hierarchy

1. **Identity and status** — learner-chosen display name, the label “Proof of progress,”
   the last-updated date, and an immediate completion-not-certification disclaimer.
2. **Verified-fact summary** — counts of visible completed courses, completed chapters,
   and completed topic-practice sessions. Counts describe activity, not proficiency.
3. **Course work** — each visible completed course or chapter group, its completion date,
   and a link to the canonical InterviewOS course explanation.
4. **Interview practice** — each visible topic with a completed custom-topic session, its
   completion date, and a link to the nearest canonical learning explanation.
5. **Disclosure boundary** — a plain-language list of what the page shows and what always
   remains private.
6. **Provenance footer** — InterviewOS recorded the listed completion events; InterviewOS
   is not certifying expertise or providing an employer endorsement.

The mobile order is identical to the reading order. Summary figures collapse from three
columns to one; activity cards collapse from two columns to one.

## Display contract

The public-page view may receive only an explicit allow-list:

| Field | Display rule |
|---|---|
| Learner display name | Owner-selected public value; never fall back to email |
| Last updated | Date of the latest public selection change |
| Course title and link | Only when the owner selected a qualifying completion |
| Chapter count | Count of selected, completed chapters only |
| Completion date | Date of the qualifying completion event |
| Practice topic | Only after a completed custom-topic interview session |
| Practice count | Count of completed sessions selected for display |

The view model must not contain raw scores, transcripts, recordings, resume content,
company or role targets, answer text, private feedback, ranks, percentiles, email
addresses, or internal user/session identifiers. Keeping those fields out of the view
model is safer than rendering them conditionally.

## Truthful language

Use “completed,” “practised,” and “recorded by InterviewOS.” Do not use “certified,”
“verified skill,” “mastered,” “expert,” “top performer,” “job-ready,” or employer
endorsement language. “Verified facts” means the product can trace a displayed item to a
qualifying completion event; it does not mean InterviewOS verified ability.

Every achievement links to a first-party explanation so a visitor can inspect what the
course or topic covers. No employer-specific process claim appears on this page.

## Owner states for the later product

The implementation design should cover these states before a route is added:

1. **Private** — no public URL resolves.
2. **Preview** — the owner sees the exact allow-listed payload, but it is not public.
3. **Published** — an opaque URL resolves only to the selected payload.
4. **Revoked** — the URL stops resolving immediately.
5. **Rotated** — the previous URL remains revoked and a new opaque URL is issued.

Selection changes should require an explicit publish action; completing another chapter
must never silently expand an already-public page.

## Accessibility and content behavior

- One page heading identifies the learner and artifact; section headings preserve a
  logical hierarchy.
- Dates use machine-readable `dateTime` values and human-readable labels.
- Links describe their destination without depending on surrounding card text.
- The disclosure boundary is text, not a tooltip or color-only status.
- Status labels repeat their meaning in text; decorative marks are hidden from assistive
  technology.
- Empty published sections should be omitted, while an empty preview should explain that
  the owner has not selected any achievements.

## Synthetic fixture represented in code

The component fixture uses a fictional learner, two course completions, and two topic
practice completions. The dates and counts are invented for layout review and are labelled
“Synthetic preview.” The component is intentionally not imported by a route.

## Decisions required before implementation

- entropy, expiry policy, rate limiting, and enumeration monitoring for public tokens;
- which display-name choices are permitted and how name changes affect cached previews;
- deletion propagation and cache invalidation guarantees;
- authorization and ownership rules for preview, publish, revoke, and rotation;
- eligibility rules and event provenance for course/chapter completion;
- whether session counts add useful evidence without encouraging volume as a proxy for
  competence;
- the final visual and content review.

Until those decisions are approved, this remains a synthetic information-architecture
prototype rather than a shippable feature.
