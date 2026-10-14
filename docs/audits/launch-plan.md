# Launch plan

**14 October 2026.** The evidence and fix details for every item are in the [architecture audit](architecture-audit.md). The "Audit" column gives the finding number there (`001` = ARCH-001).

## Verdict

**Ready to launch once the "Before launch" list is done.** That's about 5–6 days of work, including setting up hosting.

The foundations are good. Interview logic is on the server, every query is limited to the signed-in user, a retried answer is safe, and failures are reported honestly. The problems are few, specific and cheap to fix.

## The biggest risks

1. **Resume deletion is broken both ways.** Deleting a resume leaves the file in storage, and a forged request could delete another user's recordings.
2. **The API can freeze.** A burst of interviews starting together, or a slow voice service, can lock the server up until it's restarted.
3. **Crashes lock candidates out.** After a crash or a deploy, the candidate's current question or report stays locked for 10 minutes.
4. **AI cost can run away unseen.** Our own errors are retried on a model about 5× pricier, and our cost records miss failed calls.

## Decide first

| Question | Recommendation | Holds up |
|---|---|---|
| Answer recordings: stop uploading them, or upload and delete after the report? | **Stop uploading.** Nothing reads them, and we keep no one's voice. | The recordings item below; the consent text |
| Allow one test (under $0.01 of AI usage) to see whether Gemini's prompt caching works for us? | **Yes**, after launch | The prompt rewrite |

## Before launch

Do these in order. The API must not be reachable from the internet until item 1 is done.

| # | What | Why | Effort | Audit | Status |
|---|---|---|---|---|---|
| 0 | Run two read-only database checks | Shows whether the deletion exploit is live, and finds stranded resume files | 15 min | 001, 022 | Open |
| 1 | Fix resume and file deletion | Files survive deletion; forged requests can delete others' files | 5 h | 001, 011, 022 | Open |
| 2 | Split the background worker pool | Stops the API freezing under load | 6 h | 002 | Open |
| 3 | Let locks expire within a minute after a crash | Ends 10-minute lockouts after crashes and deploys | 6 h | 003, 004 | Open |
| 4 | Make the report page wait instead of erroring | A refresh during report writing shows a failure | 3 h | 004 | Open |
| 5 | Stop retrying our own errors on the pricier model | Each wrong retry costs about 5× | 3 h | 007 | Open |
| 6 | Turn on Google Cloud budget alerts and a spend cap | Our own cost records under-count | 30 min | 007 | Open |
| 7 | Move Supabase to Pro, add an email provider, test a restore | Free has no backups and 1 GB storage; built-in email may not arrive | 2–4 h | 020, 016 | Open |
| 8 | Host the API on one server in Mumbai | Nothing is hosted yet | 1 day | — | Open |

## First weeks after launch

| What | Why | Effort | Audit | Status |
|---|---|---|---|---|
| Test the database code automatically | Safety-critical SQL has never run in a test; that's how the deletion bug got through | 16–24 h | 005 | Open |
| Record every billed AI call, then add a daily spend limit | Switches off optional AI features before the bill runs away | 6–8 h | 007 | Open |
| Error tracking and alerts | Otherwise we hear about outages from users | 4 h | — | Open |
| Handle answer recordings as decided; delete question audio after each round | Storage cost and privacy | 3–4 h | 021 | Waiting on decision |
| Don't count rounds that fail on our side | Two of our failures use up a user's daily allowance | 1 h | 014 | Open |
| CAPTCHA on sign-up; tighter limits on new company lookups | A scripted account could cost $25–50 a day | 3–4 h | 012 | Open |
| Keep Hindi-script quotes in reports | Hinglish reports may come out empty | 2 h | 009 | Open |
| Cap the whiteboard's size | It's saved in full every second, with no limit | 2 h | 013 | Open |

## Later, guided by real data

- Rewrite prompts for caching, but only if the caching test shows it works (008)
- Cache the public usage counter (006)
- Pin admin access to user ids: one setting, free to do during item 8 (018)
- Check how consistent scores are (010)
- Prepare for a second server (015)
- Smaller items: a missing index (017); compressed question audio, lighter pages and paginated history (019); slower polling (013)
- Experiments on the report's thinking budget and on the interviewer's voice
- Split the 1,741-line `InterviewService` once it starts slowing changes down

## Cost at 1,000 monthly users

Assuming 5 rounds per user per month (5,000 rounds) and ₹88 to the dollar:

| | Per month |
|---|---|
| AI, at about ₹7.5 per 30-minute round | ~₹37,500 |
| Server, database and email | ~₹3,300 |

- AI is over 90% of the bill, so per-round AI cost is the number to watch.
- After the cost work, a round should cost about ₹6.5–7, or ₹5.5–6 if prompt caching works. Moving some users to the browser's built-in voice would bring it to about ₹3.5–4.

## Heads-up

This plan and the audit are in a public GitHub repository, including how the deletion exploit works. Finish item 1 before the API is reachable from the internet.
