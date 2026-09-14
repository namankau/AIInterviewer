# The source register

This is the list of pages the interviewer is allowed to treat as real knowledge about a
named employer — its hiring process, and interview questions it or a candidate has
publicly reported. PRD §04 (Tier B sources) requires a per-source review and "a
maintained source register"; PRD §16 requires a legal review of that register before
public launch. This directory, and the tooling in `scripts/source-register.mjs`, is that
register.

Nothing here is trusted by default. A source earns its place by being fetched, read, and
recorded by a person (or an agent acting on the owner's behalf) who checked what it
actually says — never by being plausible. `CLAUDE.md`'s hardest rule applies to
everything downstream of this file: **never fabricate employer-specific detail.** A
source that was not actually read is worse than no source.

## Layout

- `A-us-big-tech.json`, `B-global-product.json`, `C-india.json` — one file per research
  partition (task 036). Each is a flat, hand-curated list; nothing here is discovered by
  crawling.
- `REGISTER.md` — **generated.** Run `node scripts/source-register.mjs render` after any
  change to the JSON. Do not hand-edit it; edits will be overwritten.

## The three reuse bases

Every entry's `origin` field says why we may use it. There is no fourth option — if a
source does not fit one of these, it does not go in the register.

- **`employer`** — the company's own page about its own hiring process: a careers site's
  "how we hire" page, an interview-prep guide, an engineering-blog post about the loop.
  Highest value: this is the only origin that reliably describes *process* (stages,
  rubric, what each round looks for) rather than one candidate's anecdote. Permits reuse
  because the employer is the one making the claim about itself, in public, on their own
  domain.
- **`author`** — an individual's own account of their own interview, posted somewhere
  they control (a personal blog, a free Medium/dev.to/Hashnode/Substack post) — never a
  second-hand retelling, and never an aggregator republishing someone else's story.
  Permits reuse under attribution: the author chose to publish this account for others to
  read, and we cite them by name and link back to the original.
- **`open_licence`** — a repository or document under a licence that explicitly permits
  reuse (MIT, CC-BY, and similar). The licence file itself must be read and its terms
  recorded in `basis`, with a link. Permits reuse because the rights holder said so in
  writing, not because the content happened to be reachable.

## Hard exclusions — no exceptions

`scripts/source-register.mjs validate` enforces this list in code (see
`EXCLUDED_DOMAINS` and `hostIsExcluded` in that file) precisely so it cannot be
half-remembered later: **LeetCode** (leetcode.com, leetcode.cn, Discuss included),
**Blind** (teamblind.com), **Reddit** (reddit.com, redd.it), **Glassdoor** (every
TLD/ccTLD — glassdoor.com, glassdoor.co.in, glassdoor.co.uk, …), **AmbitionBox**
(ambitionbox.com), **GeeksforGeeks** (geeksforgeeks.org), **LinkedIn** (linkedin.com,
lnkd.in — as a *source of content*; LinkedIn *as an employer* being interviewed about its
own process is fine), **Quora** (quora.com), and **YouTube** (youtube.com, youtu.be —
video is excluded outright, transcript or not).

Why (PRD §04, and `CLAUDE.md`'s "Do not write scrapers" rule): these sites' company-wise
interview content is either against their own terms of service to republish (LinkedIn,
Blind), somebody else's paid product copied wholesale (LeetCode's company tags), or an
aggregator of other people's anonymous stories with no way to verify any single one of
them was actually asked, by whom, or when. `validate` fails the whole register — not a
warning — if any entry in `sources` resolves to one of these hosts, including a
subdomain. A rejected candidate URL naming one of these is fine to *record* in a
partition's `rejected` array (with the reason); it must never appear in `sources`.

## How to run it

```bash
# Schema check, duplicate URLs, and the hard exclusion list. Fails the build (exit 1) on
# any problem, including a source whose robotsAllows is false.
node scripts/source-register.mjs validate

# Fetches robots.txt and the page for every source, exactly as SourceFetcher.kt would —
# same User-Agent, same robots.txt semantics, same tag-stripping — and records the result
# under a `check` object on each entry. One request at a time, >= 2s between requests to
# the same host, 20s timeouts.
node scripts/source-register.mjs check
node scripts/source-register.mjs check --only "Amazon"
node scripts/source-register.mjs check --partition A-us-big-tech

# Regenerates REGISTER.md from the JSON. Deterministic — re-running it with unchanged
# JSON produces no diff.
node scripts/source-register.mjs render

# Posts every source that passed its last `check` to the running API's admin endpoint,
# then polls until each one has been fetched, failed, or blocked. Needs API_BASE_URL and
# ADMIN_ACCESS_TOKEN in the environment (see below). Never run this against production
# without the owner present — it changes what the interviewer asserts about real
# employers.
node scripts/source-register.mjs import --dry-run
node scripts/source-register.mjs import --only "Amazon"
node scripts/source-register.mjs import --timeout-minutes 30
```

All four subcommands accept `--dir <path>` to point at a different directory of JSON
files (used by the test suite's fixtures; the default is this directory).

### Environment variables `import` needs

- `API_BASE_URL` — the running API's base URL (e.g. `http://localhost:8080`).
- `ADMIN_ACCESS_TOKEN` — a bearer token for a signed-in user on `interviewos.admin.emails`
  (see `AdminAccess.kt`). `scripts/test-user.mjs` mints a session token for local testing;
  it is not an admin account by default, so the email used still needs to be added to that
  allow-list.

`import` also accepts `SOURCE_REGISTER_POLL_INTERVAL_MS` and
`SOURCE_REGISTER_POST_INTERVAL_MS` to override its default polling and pacing intervals,
and `check` accepts `SOURCE_REGISTER_MIN_HOST_INTERVAL_MS` and `SOURCE_REGISTER_TIMEOUT_MS`
— these exist so the test suite can run against a local fixture server in milliseconds
rather than the real, polite pacing this tool uses against actual employer sites. There is
no reason to set them outside a test.

## What `check` records, and what `import` requires

Each source gets a `check` object: `checkedAt`, `robotsAllowed`, `httpStatus`,
`readableChars` (the length of the text `SourceFetcher.readableText` would extract, capped
at `MAX_CONTENT_CHARS`), `readable` (`readableChars >= 800`), and `error`. `import` skips
any source whose last check failed robots, failed HTTP, or came back under the 800-character
readable threshold — unless run with `--force`.

## What the owner still owes this register

- **A per-source review (PRD §04).** Every entry's `basis` and `summary` were written by
  the agent that found it, from one read of the page. Nobody with a stake in the product
  has independently confirmed any of them yet.
- **A legal review of the whole register before public launch (PRD §16).** Nothing here
  has had one. In particular: robots.txt compliance is necessary but not sufficient —
  it says a page may be *fetched*, not that its content may be *reused* in a commercial
  product, and that second question has not been asked of counsel for any entry here.

## A note on `AddLinkRequest` and Jackson

`import` posts `origin` and `publishedOn` in addition to the fields the admin endpoint
currently accepts (`url`, `title`, `publisher`, `companyName`). Task 035, on a separate
branch, adds those two fields to `AddLinkRequest`. There is no custom `ObjectMapper` or
`spring.jackson.deserialization.fail-on-unknown-properties` setting anywhere in
`apps/api` — Spring Boot's own `JacksonAutoConfiguration` disables
`FAIL_ON_UNKNOWN_PROPERTIES` by default — so posting these two extra fields against
*today's* `AddLinkRequest` does not error; Jackson silently drops them. `import` is
therefore safe to run against either branch: before task 035 merges, `origin` and
`publishedOn` are accepted and ignored; after it merges, they are accepted and used.
