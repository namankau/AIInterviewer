# Task 036 — The source register: research, record, import

PRD §04 (Tier B: *"employer career-site process pages; openly-licensed repositories;
official competency frameworks … individual authors' own blog posts used with attribution
or permission. Requires a per-source review and a maintained source register"*), §16
(*"Maintain a source register … obtain a legal review of the source register before public
launch"*). Part of the overnight run: read [`overnight-2026-09-14.md`](overnight-2026-09-14.md)
first.

## Why

The bank from task 035 is only as good as what goes into it. Today the library holds one
source — a study plan, filed as Google, whose extraction failed. The owner asked for public
interview experiences for every major product software company. This task finds the ones
we may use, checks each one, and records it so the owner can review the whole register in
the morning.

## Hard exclusions — no exceptions, not even one page

LeetCode (Discuss included), Blind / teamblind, Reddit, Glassdoor, AmbitionBox,
GeeksforGeeks, LinkedIn, Quora. Anything behind a login or a paywall — Medium member-only
posts included. Aggregators that republish other people's content. **Any repository or
dataset derived from LeetCode's company tags** (the "LeetCode company-wise questions"
repos): that is LeetCode's paid product, copied. Video.

When a search leads to one of these, move on. Record notable rejections, with the reason.

## Research — three partitions, one agent each, in parallel

- **A — US big tech:** Google, Amazon, Microsoft, Meta, Apple, Netflix, Nvidia, Salesforce,
  Oracle, Adobe, Uber, Airbnb, LinkedIn (as an employer), Intuit, PayPal, Snowflake,
  Databricks, Pinterest, Dropbox, Stripe.
- **B — global product beyond the US giants:** Atlassian, Shopify, Spotify, Booking.com,
  Adyen, SAP, Zalando, Klarna, Revolut, N26, Canva, Grab, GitLab, Cloudflare, Twilio,
  Datadog, MongoDB, Elastic, JetBrains, Wise.
- **C — India product and engineering centres:** Flipkart, Swiggy, Zomato, Razorpay,
  Zerodha, Freshworks, Zoho, CRED, Meesho, PhonePe, Paytm, Ola, Walmart Global Tech, Goldman
  Sachs (engineering), JPMorgan Chase (technology), Uber India, Postman, BrowserStack,
  InMobi, Myntra.

For each company, in this order of value:

1. **The employer's own pages** about how it interviews — careers "how we hire" pages,
   interview preparation guides, engineering-blog posts about its own process.
   `origin: "employer"`. These carry the loop structure task 037 needs.
2. **Individual authors' own posts** reporting a specific loop at that company, with the
   questions actually asked — personal blogs, free Medium / dev.to / Hashnode / Substack
   posts. `origin: "author"`, used with attribution. Prefer the last three years, specific
   (named questions, named rounds), and software engineering roles.
3. **Openly licensed repositories or documents** describing company interview formats.
   Read the licence file and record the licence. `origin: "open_licence"`.

Three to six good sources per company. Fewer, real and specific beats many and vague.

### Verification — every entry

- **You fetched the URL yourself and it says what your entry says it says** — process
  detail, or questions reported as actually asked, at that company. **Never write down a
  URL you have not fetched.** An invented URL in the register is exactly the fabrication
  this product must not commit, and the owner will be reading these as fact.
- robots.txt checked for a generic crawler.
- Whether the text survives a plain GET with tags stripped (that is all `SourceFetcher`
  does — no JavaScript). If the page is probably rendered client-side, set
  `readableWithoutJs: false`; the owner can upload it as a document instead.

### Output — per research agent, outside the repo

`c:\tmp\source-register\<partition>.json` (`A-us-big-tech.json`, `B-global-product.json`,
`C-india.json`). Do not touch the repository.

```json
{
  "partition": "A-us-big-tech",
  "checkedOn": "2026-09-14",
  "sources": [
    {
      "url": "https://…",
      "title": "As the page titles itself",
      "publisher": "Amazon | the author's name | the author's name (Medium)",
      "companyName": "Amazon",
      "origin": "employer | author | open_licence",
      "basis": "Why we may use it: 'Amazon's own careers page on its interview process' / 'MIT licence — <link to licence>' / 'The author's own post, cited and linked'",
      "contributes": ["process", "questions"],
      "roleFamily": "software_engineering | null",
      "publishedOn": "YYYY-MM-DD or null — only if the page says",
      "summary": "One line on what is actually there: 'Names the five stages of the SDE loop and the bar raiser' / 'Six questions from a 2024 L4 onsite, two coding, one design, three behavioural'",
      "robotsAllows": true,
      "readableWithoutJs": true
    }
  ],
  "rejected": [{ "url": "…", "reason": "member-only Medium post" }],
  "gaps": ["Companies for which nothing usable was found, and what was tried"]
}
```

## Tooling — one agent, its own worktree, branch `feat/source-register`

- `docs/source-register/` holds the partitions' JSON (the orchestrator copies them onto the
  branch) and a README: what the register is, the three reuse bases, and the review the
  owner still owes it (PRD §04 per-source review; §16 legal review before public launch).
- `scripts/source-register.mjs`, no new dependencies, Node ≥ 20:
  - **`validate`** — schema check, duplicate URLs, and a hard failure on any URL from the
    exclusion list. The list lives in the script, so the rule is enforced rather than
    remembered.
  - **`check`** — for each URL, what `SourceFetcher` will see: robots.txt with the same
    user agent and the same semantics as `RobotsRules.kt`; a plain GET with
    `SourceFetcher`'s User-Agent; tags stripped the way `readableText` strips them; the
    length of readable text. Writes results back into the JSON. One request at a time, and
    a pause between requests to the same host.
  - **`render`** — generates `docs/source-register/REGISTER.md` from the JSON (grouped by
    company: title, origin, publisher, basis, checked on, robots, readable), so the two
    cannot drift.
  - **`import`** — for each entry that passed `check`, `POST /api/v1/admin/sources/links`
    with url, title, publisher, companyName, origin and publishedOn (task 035 adds the last
    two; send them), against an API base URL and bearer token taken from the environment.
    Then poll `GET /api/v1/admin/sources` and print each source's status and question
    count. Idempotent — re-adding a URL re-reads it, which is existing behaviour.
    `--only <company>` for a partial run.
  - Tests for `validate` and `render` with `node --test`. Hook them into CI only if it is
    one line; do not restructure CI.
- **Do not run `import`.** The orchestrator runs it after 035 and 037 are merged.

## Done when

Three partition files exist and every entry in them was fetched and checked; the script
validates, checks and renders them; `REGISTER.md` is generated; CI is green on
`feat/source-register`.
