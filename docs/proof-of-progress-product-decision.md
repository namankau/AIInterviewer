# Product decision: proof of progress, not a cloned Trailhead

**Status:** Proceed in phases; do not build a full Trailhead-style runtime yet
**Date:** 2026-09-25
**Related product areas:** courses, topic interviews, profile, sharing

## Decision

InterviewOS should make completed learning and practice portable, but the first product
should be an **opt-in public proof-of-progress page**. GitHub export follows only after
that page proves useful. A broad Salesforce Trailhead-style playground is not justified
yet.

Salesforce's Trailhead Playground is an isolated Salesforce organisation in which a
learner can install packages and change platform configuration without affecting a
production organisation. That environment is useful because operating the Salesforce
platform is itself the skill being demonstrated. InterviewOS teaches and assesses
knowledge across many topics; reproducing an IDE, container platform, and product
sandbox would add security and infrastructure cost without improving most interview
practice.

InterviewOS already has the right narrower foundation: every course chapter has an
editable playground, Python can run locally in the browser, and each topic now has a
dedicated voice interview. The product opportunity is to connect those activities into
credible evidence, not to clone a general-purpose development environment.

## Product promise

> Learn a topic, practise explaining it under interview conditions, and share what you
> completed without exposing your private answers or pretending that completion proves
> job proficiency.

The word **completed** is deliberate. InterviewOS must not market a completion badge as
certification, skill mastery, or an employer endorsement.

## Phased delivery

### Phase 1 — private-by-default proof-of-progress page

Build this first.

- A user can create an opaque, revocable public link from their profile.
- The user chooses which achievements are visible. Nothing becomes public merely because
  it was completed.
- Show verified facts only: completed course chapters, completed courses, topics practised
  in interviews, and the completion date.
- A topic counts as "interview practised" only after a completed custom-topic session; a
  page visit or abandoned session does not count.
- Link each visible achievement to an InterviewOS explanation of what the course or topic
  covers.
- Keep raw scores, transcripts, recordings, resume content, company targets, answer text,
  and private feedback hidden. Do not publish rank or percentile until there is a stable,
  defensible comparison population.
- Let the owner disable the page or rotate its URL immediately.

This gives recruiters a human-readable artifact and gives learners something useful for
a resume without adding an external account dependency.

### Phase 2 — explicit GitHub export

Add only after measuring demand for Phase 1.

- Use a GitHub App installed on repositories the user explicitly selects.
- Request the minimum repository permission required to create or update the selected
  progress file (repository contents: write). Do not request organisation, issues,
  pull-request, workflow, or broad account permissions.
- Preview every change and require an explicit confirmation before writing.
- Export a small Markdown file that links to the canonical public progress page, plus a
  versioned JSON manifest for portability.
- Update one stable file serially and preserve its latest blob SHA; do not manufacture
  daily commits, contribution streaks, or activity that could be mistaken for software
  work.
- Make disconnect and token revocation clear. Removing the GitHub connection must not
  remove the user's InterviewOS history.

GitHub itself recommends using a profile, profile README, repositories, and achievements
to present work to employers. A reviewed progress artifact fits that model better than
trying to inflate the contribution graph.

### Phase 3 — assessed hands-on labs

Extend the existing course playground only where executable work materially demonstrates
the topic.

- Start with deterministic Python exercises that can run in the existing browser runner.
- Store attempts only when the learner asks to save them.
- Add automated checks with visible criteria and record a completion only when those
  checks pass.
- Treat Java or system-design labs as separate investments: Java requires a safe runner;
  system design needs structured rubrics rather than pretending a text box is a sandbox.
- Do not offer shell, arbitrary network access, secrets, or production integrations.

This is the InterviewOS equivalent of a Trailhead hands-on challenge: small, bounded,
assessed work attached to a learning objective—not a general cloud development account.

## Release gates

Phase 1 touches privacy, public visibility, and user-owned learning records. It therefore
requires a human-reviewed product and data-handling design before implementation. At
minimum, the implementation needs:

1. an explicit visibility model and threat review for link discovery;
2. account-deletion behavior for public pages and cached previews;
3. tests proving another user cannot modify the page;
4. accessible preview, publish, revoke, and URL-rotation controls;
5. clear language distinguishing completion from certification.

Phase 2 additionally requires a GitHub App, an installation and revocation flow, token
storage and rotation, repository-selection UX, audit logs, and failure recovery for a
file changed concurrently on GitHub.

## Success criteria

Evaluate the idea with a small, honest funnel:

- percentage of eligible learners who preview a public page;
- percentage who publish one;
- published pages that receive at least one external visit within 30 days;
- resume/profile link copy rate;
- revocation and support rates;
- qualitative feedback from recruiters on whether the evidence is understandable.

Do not optimise for number of badges, generated commits, or page impressions without an
external visit. Those metrics reward noise rather than proof.

## Explicit non-goals

- No full cloud IDE, isolated Salesforce-like organisation, or arbitrary-code container.
- No public leaderboard or comparative skill claim.
- No automatic GitHub commits in the background.
- No raw interview evidence, employer target, or resume detail on a public page.
- No blockchain credential or paid certificate in this phase.

## Suggested implementation backlog

1. Research and prototype the public-page information architecture with synthetic data.
2. Write the visibility/data-retention design and have it reviewed.
3. Implement Phase 1 behind a feature flag with API authorization tests.
4. Measure the success criteria for at least one product cycle.
5. If GitHub export demand is real, design the GitHub App and its least-privilege flow.
6. Pilot one deterministic assessed Python lab before generalising the lab model.

## Sources checked

- [Salesforce: Create a Trailhead Playground](https://trailhead.salesforce.com/content/learn/modules/trailhead_playground_management/create-a-trailhead-playground)
- [GitHub: About your personal profile](https://docs.github.com/en/account-and-profile/concepts/personal-profile)
- [GitHub: Using your GitHub profile to enhance your resume](https://docs.github.com/en/account-and-profile/tutorials/using-your-github-profile-to-enhance-your-resume)
- [GitHub REST API: Repository contents](https://docs.github.com/en/rest/repos/contents)
- [GitHub: Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
