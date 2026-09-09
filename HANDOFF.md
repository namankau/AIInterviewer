# Handoff — 2026-09-09

## Task
"How would you save on AI cost here" — an interview was costing ₹50–100 against a target
of ₹5–10 for a 40-minute round. The owner asked specifically about running a local
transcriber (Whisper) to bring it down.

## What I found

**It is not a token-efficiency problem, and Whisper is not the lever.** Measured, not
estimated — from `session_reports`, `session_turns`, and live calls to both models:

| | |
|---|---|
| Report call, `gemini-2.5-flash-lite` | 4,192 prompt / 3,049 output → **₹0.14** |
| Same call, `gemini-3.5-flash` | 15× input, 22× output, **~1,700 tokens of thinking** → ₹3.11 |
| Of 3 stored reports | **2 were served by `gemini-3.5-flash`** |

The provider chain is ordered cheapest-first and reads as though a round runs on
flash-lite. It was not. Modelled over 30 turns, the same 40-minute round is **₹8.02 on
flash-lite and ₹39–74 on the model behind it** — which is exactly the ₹50–100 observed,
and 15 of 22 sessions being abandoned puts a further 4.4× on spend per *completed*
interview.

Tested directly, three runs each on the same prompt and schema: flash-lite returned valid
JSON 3/3 in half the latency. The fall-through was not buying quality. It was invisible.

Where ₹8.02 actually goes, and what each lever is worth:

| share | | lever |
|---|---|---|
| 71.1% | interviewer speech (Gemini TTS) | browser voice → ₹0 (shipped); local Piper/Kokoro for the fallback |
| 9.7% | static prompt resent every turn | ₹0.59 if cached — needs the prompt reordered |
| 6.4% | the candidate's audio | **₹0.51 — this is what local Whisper saves** |
| 5.8% | transcript history | — |
| 5.3% + 1.8% | assessment output, report | — |

## What I built
- **`ai_calls`** (migration `20260909120000`) — one row per answered model call: provider,
  model, tokens, cost in micro-USD, and **`fell_back_from`**, the field the table exists
  for. Written in its own transaction (`REQUIRES_NEW`): a call is billed whether or not
  the turn survives, and abandoned turns are the expensive ones.
- **`AiPrices`** — published prices, and an unpriced model costed at the *dearest* tier
  rather than zero, because "free" is how the expensive model stayed hidden.
- **`AiUsage`** gains thinking, audio and cached tokens. Thinking is billed at the output
  rate and reported in its own field, so the previous code undercounted every report
  written by `gemini-3.5-flash` by roughly half.
- **Attribution** (`AiSpendContext`) re-established per speech call — synthesis runs on a
  background thread and fans chunks out to more of them, so nothing survives the hops.

### Reading it
```sql
-- What one round cost, by call.
select call, model, fell_back_from, sum(micro_usd)/1e6 as usd
from ai_calls where session_id = '<id>' group by 1,2,3 order by usd desc;

-- The question this was built to answer: how often is the dear model serving?
select model, fell_back_from is not null as fell_back, count(*), sum(micro_usd)/1e6 as usd
from ai_calls where occurred_at > now() - interval '7 days' group by 1,2 order by usd desc;
```

## Assumptions I made
- 30 turns in a 40-minute round, from a measured ~80s per turn. The longest real session
  on record is 16 turns, so this is deliberately pessimistic.
- ₹88/USD, and 25 audio tokens per second (published). Speech at ~14 chars/second.
- Prices as published on 2026-09-09. They go stale; `AiPrices` is where they live.

## What I could NOT verify
- **Why flash-lite was stepped over.** It answers the report call correctly and fast, so
  the fall-through is not a capability problem — most likely free-tier rate limiting. The
  ledger will now say. I deliberately changed no routing: rerouting before it can answer
  would be guessing, and guessing is what produced the invisible bill.
- **Whether flash-lite handles a real spoken answer as well.** Downloading a stored
  recording to test was blocked by the sandbox; one real round settles it.
- Nothing in this change alters behaviour — no call is rerouted, retried or reworded.

## Verification status
- ktlintCheck / test / build: **pass**. 195 backend tests, 0 failures.
- CI green on run `34347994993` before merging.
- RLS proved closed by inserting a probe row and reading it back as an anon client
  (0 rows to the client, 1 to the service role). Probe removed.

## Merge status
- Merged into `develop` at `a73e295`. **Migration `20260909120000` applied** and verified.

## Suggested next task
Sit one real round, then run the second query above. If `fell_back` is true for most
calls, the fix is quota on the Google project, not code — and it is worth ~₹31 a round.

## Open questions for you
1. **Local TTS is the only remaining lever worth real money** (71% of what is left), and
   it commits infrastructure — CLAUDE.md reserves voice-vendor choices for you. Piper is
   tiny and CPU-only; Kokoro-82M sounds markedly better for a little more. Say which and
   I will wire it behind the browser voice.
2. **Local Whisper saves ₹0.51 a round** and costs you delivery assessment (pace,
   hesitation, recovery under pressure) which the report currently uses. I would not.
3. Still open from before: the Gemini speech quota (100/day), the design direction, and
   `main` being ~70 commits behind `develop`.
