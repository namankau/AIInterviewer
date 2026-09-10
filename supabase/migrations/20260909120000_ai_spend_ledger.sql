-- What each model call cost (PRD 10: pricing has to be grounded in unit economics).
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- This table exists because the cost of an interview was unanswerable. `session_reports`
-- has carried `model`, `prompt_tokens` and `output_tokens` since the first migration,
-- with a comment saying per-session cost is what decides pricing -- and that was the only
-- call of the eight in the loop that recorded anything. An interview makes tens of calls
-- and kept no record of any of them.
--
-- What the missing record hid: the provider chain is ordered cheapest-first, so the code
-- reads as though a round runs on `gemini-2.5-flash-lite`. Two of the three reports that
-- had been written by the time this was added were served by `gemini-3.5-flash` instead,
-- which is 15x the input price and 22x the output price. Same prompt, same schema,
-- indistinguishable results, 35x the cost -- and nothing in the product, the logs or the
-- database said which one had answered. A fall-through nobody can see is not resilience,
-- it is an unbounded bill.
--
-- So `fell_back_from` is the point of this table. Everything else is supporting detail.

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- The interface method, not the HTTP route: `assessAnswer`, `composeReport`,
  -- `synthesizeSpeech`. Cost questions are always about a call site.
  call text not null check (length(btrim(call)) > 0),
  provider text not null,
  model text not null,
  -- Null when the first-choice provider served, which is the case worth being able to
  -- filter for. Non-null means the cheap model refused and something dearer answered.
  fell_back_from text,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Billed at the output rate and reported in its own field, so anything reading
  -- output_tokens alone undercounts. Measured at roughly half the output bill on a
  -- report composed by gemini-3.5-flash.
  thought_tokens integer not null default 0 check (thought_tokens >= 0),
  -- Both are subsets of prompt_tokens, priced differently: audio dearer, cached cheaper.
  audio_tokens integer not null default 0 check (audio_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),
  -- Millionths of a US dollar. Integer because this column gets summed over every call
  -- ever made and floating-point drift in a figure used to set a price is the kind of
  -- bug found only after the price is wrong. USD because that is the currency the
  -- provider bills in; converting for display is a presentation concern with a rate
  -- that changes daily.
  micro_usd bigint not null default 0 check (micro_usd >= 0),
  -- Both null out rather than cascade, and the distinction is deliberate.
  --
  -- Account deletion must actually delete (CLAUDE.md), and it does: nulling user_id
  -- destroys the link between this row and a person. What is left is an anonymous fact
  -- about what the product spent, which is accounting rather than personal data, and
  -- deleting it would mean a candidate exercising their data rights silently rewrote
  -- last quarter's costs. The same holds for a round the candidate deletes: the money
  -- was spent, and the ledger has to still say so.
  user_id uuid references public.users (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null
);

-- What the cost of one interview is read by.
create index ai_calls_session_idx on public.ai_calls (session_id);

-- Spend over a window, and the fall-through rate within it -- the two questions this
-- table is actually asked.
create index ai_calls_occurred_idx on public.ai_calls (occurred_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Enabled with no policies, which denies every client outright. That is the intent, not
-- an unfinished job: this is the product's own cost accounting and no candidate has any
-- business reading it -- least of all the rows belonging to other people, which is what
-- an aggregate over this table would expose. The API connects as the database owner and
-- so is not subject to these policies; the ledger is written and read from there.
-- ---------------------------------------------------------------------------
alter table public.ai_calls enable row level security;

comment on table public.ai_calls is
  'One row per model call: what was asked for, which provider answered, what it cost. '
  'fell_back_from being non-null means a dearer provider served after a cheaper one '
  'refused -- the condition that made interviews cost 5-10x what the configuration '
  'implied, with nothing anywhere reporting it.';
