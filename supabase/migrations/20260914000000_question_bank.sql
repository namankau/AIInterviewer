-- The company-tagged question bank (PRD 04, 08, 10). Task 035.
--
-- Owned by the Supabase CLI. Apply with `npm run db:push`.
--
-- What changes: the library used to store each extracted question against one free-text
-- `company_name`, so the same question read from two sources was two unrelated rows and
-- nothing could say "reported at Amazon and at Microsoft, by three sources". Now:
--
--   companies        one row per employer, with the exact other names it goes by
--   bank_questions   one row per distinct question, keyed on a normalised fingerprint
--   source_questions becomes the REPORT table: source S says question Q was asked at
--                    company C. One row per (source, question, company).
--
-- **Tags are never written, only derived.** A company tag on a question exists exactly
-- while at least one fetched source reports the question at that company. Delete the
-- source and its reports go with it (the existing cascade), and a tag with no report left
-- disappears on its own, because it was only ever a query over reports. That is the rule
-- this whole design exists to keep: every company tag is backed by a document a candidate
-- can open.
--
-- Questions a model wrote never enter the bank. The only writer is the extractor, and it
-- only records what a fetched document says was asked.
--
-- Additive only: new tables, new nullable or defaulted columns, one view, one function.
-- Nothing is dropped or renamed, so applying this ahead of the code that uses it breaks
-- nothing -- the old code keeps reading `company_name`, which is still written.

-- ---------------------------------------------------------------------------
-- The fingerprint -- the one definition of "the same question"
--
-- Mirrored by `QuestionFingerprint` in the API. The two must agree, so the rule is
-- deliberately independent of database locale and of any Unicode table: a rule that
-- lower-cased with `lower()` would give a different answer on a database whose locale
-- differs from the JVM's, and the disagreement would surface as a duplicate question
-- rather than as an error.
--
--   1. ASCII A-Z become a-z. Nothing else changes case.
--   2. Apostrophes are deleted: ' U+2018 U+2019 -- so "what's" and "whats" agree.
--   3. Common typographic punctuation becomes a space: no-break space, guillemets,
--      zero-width space, the hyphen and dash family, curly double quotes, bullet,
--      ellipsis, minus sign, byte-order mark.
--   4. Every run of ASCII characters other than a-z, 0-9, '+' and '#' becomes one space.
--      ('+' and '#' survive so that C++ and C# are not the same question as C.)
--   5. Leading and trailing spaces are removed.
--
-- Everything outside ASCII that step 3 does not name is kept exactly as written, so a
-- question in Devanagari keeps every character it had.
-- ---------------------------------------------------------------------------

create function public.question_fingerprint(question text) returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        question,
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
          || chr(160) || chr(171) || chr(187) || chr(8203)
          || chr(8208) || chr(8209) || chr(8210) || chr(8211) || chr(8212) || chr(8213)
          || chr(8220) || chr(8221) || chr(8222) || chr(8226) || chr(8230) || chr(8722)
          || chr(65279)
          -- Past the end of the replacement list, so translate() deletes them.
          || chr(39) || chr(8216) || chr(8217),
        'abcdefghijklmnopqrstuvwxyz' || repeat(' ', 17)
      ),
      '[\x01-\x22\x24-\x2a\x2c-\x2f\x3a-\x60\x7b-\x7f]+',
      ' ',
      'g'
    ),
    ' '
  )
$$;

comment on function public.question_fingerprint(text) is
  'Normalised question text: the definition of "the same question" in the bank. Mirrored '
  'by QuestionFingerprint in the API; the vectors checked below are shared with its test.';

-- The two implementations are checked against the same vectors: here, when this migration
-- is applied, and by `QuestionFingerprintTest`, which reads them out of this file. If the
-- database disagrees with any of them, the migration fails rather than writing a bank that
-- splits one question in two.
do $$
declare
  vector record;
begin
  for vector in
    select *
      from (values
        -- fingerprint-vectors:begin
        ('Tell me about a time you disagreed with your manager.', 'tell me about a time you disagreed with your manager'),
        ('  Design   a URL shortener!  ', 'design a url shortener'),
        ('What''s the difference between a process and a thread?', 'whats the difference between a process and a thread'),
        ('What’s the difference between a process and a thread?', 'whats the difference between a process and a thread'),
        ('Reverse a linked list — iteratively, then recursively…', 'reverse a linked list iteratively then recursively'),
        ('Implement an LRU cache (get/put in O(1)).', 'implement an lru cache get put in o 1'),
        ('“Why Amazon?”', 'why amazon'),
        ('• Two-sum: return the indices.', 'two sum return the indices'),
        ('Explain C++ templates vs. C# generics', 'explain c++ templates vs c# generics'),
        ('Find the k-th largest element in O(n − k)', 'find the k th largest element in o n k'),
        ('Kya aap apne project ke baare mein bata sakte hain?', 'kya aap apne project ke baare mein bata sakte hain'),
        ('आपने सबसे कठिन बग कैसे ठीक किया?', 'आपने सबसे कठिन बग कैसे ठीक किया'),
        ('Café Culture?', 'café culture'),
        ('???', ''),
        ('A', 'a')
        -- fingerprint-vectors:end
      ) as v (input, expected)
  loop
    if public.question_fingerprint(vector.input) is distinct from vector.expected then
      raise exception 'question_fingerprint(%) returned %, expected %',
        vector.input, public.question_fingerprint(vector.input), vector.expected;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- companies -- one row per employer
--
-- `aliases` are other exact names for the SAME employer, lower-cased: `facebook` for
-- Meta, `ernst & young` for EY. Never a subsidiary, a region or a division. "Google Cloud
-- India" is not Google, "Walmart Global Tech" is not an alias of Walmart, and AWS is not
-- Amazon: a tag is a claim about which employer asked, and a looser match would put
-- one company's questions under another's name.
--
-- `archetype` is set only where the routing table (`ArchetypeResolver.KNOWN`) already
-- decides it, so the two cannot disagree. Everyone else is null until somebody decides,
-- and a round for them runs on the resolver's inferred archetype, labelled as inferred.
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null
    constraint companies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null
    constraint companies_name_not_blank check (length(btrim(name)) > 0),
  aliases text[] not null default '{}'
    constraint companies_aliases_lower_case check (aliases::text = lower(aliases::text)),
  archetype public.employer_archetype,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint companies_slug_unique unique (slug)
);

-- Exact, case-insensitive name lookup, and one company per name however it is cased.
create unique index companies_name_unique_idx on public.companies (lower(name));

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bank_questions -- one row per distinct question
--
-- `text` is the wording of the first report. `fingerprint` is computed by the database
-- from it, so a row can never carry a fingerprint that disagrees with its own text.
-- ---------------------------------------------------------------------------

create table public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  text text not null
    constraint bank_questions_text_not_blank check (length(btrim(text)) > 0),
  fingerprint text generated always as (public.question_fingerprint(text)) stored,
  -- Null when no report said which round it came from.
  round_type public.round_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_questions_fingerprint_unique unique (fingerprint),
  constraint bank_questions_fingerprint_not_empty check (fingerprint <> '')
);

create trigger bank_questions_set_updated_at
before update on public.bank_questions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- interview_sources -- how we may use a source, and which extractor last read it
-- ---------------------------------------------------------------------------

create type public.source_origin as enum (
  'employer',       -- the employer's own published page about how it hires
  'open_licence',   -- an openly licensed repository or document
  'author'          -- an individual's own post, used with attribution
);

-- Null for sources added before this existed. Shown to candidates next to every
-- citation: "Amazon's own site" reads differently from "a published account by".
alter table public.interview_sources add column origin public.source_origin;

-- Which version of the extractor produced this source's questions. A source behind the
-- current version is re-read even when its content has not changed, or it would keep
-- the old shape for ever. Existing rows are version 1 by definition.
alter table public.interview_sources add column extractor_version integer not null default 1;

-- ---------------------------------------------------------------------------
-- source_questions -- now the report table
--
-- `bank_question_id` cascades. A report is evidence FOR a bank question; with the
-- question deleted, the report is evidence for nothing, and keeping it with a null link
-- would leave a question that grounding could still read but the bank could not show --
-- two different answers to "what do we hold for Amazon". Nullable only because legacy
-- rows whose text normalises to nothing (pure punctuation) have no question to join.
--
-- `company_id` is set null rather than cascading: deleting a company removes a claim
-- about who asked, not the evidence that the question was reported at all.
-- ---------------------------------------------------------------------------

alter table public.source_questions
  add column bank_question_id uuid references public.bank_questions (id) on delete cascade;

alter table public.source_questions
  add column company_id uuid references public.companies (id) on delete set null;

create index source_questions_bank_question_idx on public.source_questions (bank_question_id);
create index source_questions_company_idx on public.source_questions (company_id, bank_question_id);

-- ---------------------------------------------------------------------------
-- Derived tags: (bank question, company) with corroboration and recency
--
-- Corroboration is distinct fetched sources, not rows: one source listing a question
-- twice is one source. Last reported is the latest date a source says it was asked, and
-- only where no source says that, the latest publication date of those that reported it
-- -- so recency is never overstated by a recent post recounting an old interview.
-- Sources that are pending, failed or blocked count for nothing.
--
-- security_invoker, so the view reads with the caller's rights and the RLS below still
-- applies to it. Without it a view is a hole through every policy on its tables.
-- ---------------------------------------------------------------------------

create view public.bank_question_tags
with (security_invoker = true)
as
select q.bank_question_id,
       q.company_id,
       count(distinct q.source_id)::integer as corroboration,
       coalesce(max(q.asked_on), max(s.published_on)) as last_reported
  from public.source_questions q
  join public.interview_sources s on s.id = q.source_id
 where s.status = 'fetched'
   and q.bank_question_id is not null
   and q.company_id is not null
 group by q.bank_question_id, q.company_id;

comment on view public.bank_question_tags is
  'Company tags on bank questions, derived from reports by fetched sources. Never written '
  'directly: a tag exists exactly while a fetched source reports the question there.';

-- ---------------------------------------------------------------------------
-- Seed: every employer the routing table knows, then the major product software
-- employers beyond it. Aliases are other names for the same legal employer, including
-- former names (Facebook, Freshdesk, TransferWise) -- never a parent, subsidiary or region.
-- ---------------------------------------------------------------------------

insert into public.companies (slug, name, aliases, archetype) values
  -- Global product (ArchetypeResolver.KNOWN)
  ('google', 'Google', '{"google llc","google inc"}', 'global_product'),
  ('amazon', 'Amazon', '{"amazon.com"}', 'global_product'),
  ('microsoft', 'Microsoft', '{"microsoft corporation"}', 'global_product'),
  ('atlassian', 'Atlassian', '{}', 'global_product'),
  ('uber', 'Uber', '{"uber technologies"}', 'global_product'),
  ('meta', 'Meta', '{"facebook","meta platforms"}', 'global_product'),
  ('apple', 'Apple', '{"apple inc"}', 'global_product'),
  ('netflix', 'Netflix', '{}', 'global_product'),
  ('adobe', 'Adobe', '{"adobe inc","adobe systems"}', 'global_product'),
  -- Indian product (KNOWN)
  ('zoho', 'Zoho', '{"zoho corporation","zoho corp"}', 'indian_product'),
  ('freshworks', 'Freshworks', '{"freshdesk"}', 'indian_product'),
  ('razorpay', 'Razorpay', '{}', 'indian_product'),
  ('zerodha', 'Zerodha', '{}', 'indian_product'),
  ('swiggy', 'Swiggy', '{}', 'indian_product'),
  ('zomato', 'Zomato', '{}', 'indian_product'),
  ('flipkart', 'Flipkart', '{}', 'indian_product'),
  ('paytm', 'Paytm', '{"one97 communications"}', 'indian_product'),
  ('cred', 'CRED', '{}', 'indian_product'),
  ('meesho', 'Meesho', '{}', 'indian_product'),
  -- Service-based IT (KNOWN)
  ('tcs', 'Tata Consultancy Services', '{"tcs"}', 'service_based_it'),
  ('infosys', 'Infosys', '{}', 'service_based_it'),
  ('wipro', 'Wipro', '{}', 'service_based_it'),
  ('cognizant', 'Cognizant', '{"cognizant technology solutions"}', 'service_based_it'),
  ('capgemini', 'Capgemini', '{}', 'service_based_it'),
  ('ltimindtree', 'LTIMindtree', '{"lti mindtree"}', 'service_based_it'),
  ('hcltech', 'HCLTech', '{"hcl","hcl technologies","hcl tech"}', 'service_based_it'),
  ('tech-mahindra', 'Tech Mahindra', '{"techmahindra"}', 'service_based_it'),
  ('mphasis', 'Mphasis', '{}', 'service_based_it'),
  -- Consulting and Big Four (KNOWN)
  ('deloitte', 'Deloitte', '{}', 'consulting_big_four'),
  ('ey', 'EY', '{"ernst & young","ernst and young"}', 'consulting_big_four'),
  ('pwc', 'PwC', '{"pricewaterhousecoopers"}', 'consulting_big_four'),
  ('kpmg', 'KPMG', '{}', 'consulting_big_four'),
  ('accenture', 'Accenture', '{}', 'consulting_big_four'),
  ('mckinsey', 'McKinsey & Company', '{"mckinsey","mckinsey and company"}', 'consulting_big_four'),
  ('bain', 'Bain & Company', '{"bain","bain and company"}', 'consulting_big_four'),
  ('bcg', 'Boston Consulting Group', '{"bcg","the boston consulting group"}', 'consulting_big_four'),
  -- European employers (KNOWN)
  ('booking-com', 'Booking.com', '{"booking"}', 'european_employer'),
  ('adyen', 'Adyen', '{}', 'european_employer'),
  ('sap', 'SAP', '{}', 'european_employer'),
  ('zalando', 'Zalando', '{}', 'european_employer'),
  ('n26', 'N26', '{}', 'european_employer'),
  ('revolut', 'Revolut', '{}', 'european_employer'),
  ('spotify', 'Spotify', '{}', 'european_employer'),
  ('klarna', 'Klarna', '{}', 'european_employer'),
  -- GCC and captive centres (KNOWN)
  ('goldman-sachs', 'Goldman Sachs', '{"goldman"}', 'gcc_captive'),
  ('jpmorgan-chase', 'JPMorgan Chase', '{"jpmorgan","jp morgan","j.p. morgan","jpmorgan chase & co.","jp morgan chase"}', 'gcc_captive'),
  ('barclays', 'Barclays', '{}', 'gcc_captive'),
  ('hsbc', 'HSBC', '{}', 'gcc_captive'),
  ('optum', 'Optum', '{}', 'gcc_captive'),
  ('walmart', 'Walmart', '{}', 'gcc_captive'),
  -- Product software employers beyond the routing table. Archetype left to the resolver.
  ('nvidia', 'Nvidia', '{"nvidia corporation"}', null),
  ('salesforce', 'Salesforce', '{}', null),
  ('oracle', 'Oracle', '{"oracle corporation"}', null),
  ('linkedin', 'LinkedIn', '{}', null),
  ('stripe', 'Stripe', '{}', null),
  ('airbnb', 'Airbnb', '{}', null),
  ('databricks', 'Databricks', '{}', null),
  ('snowflake', 'Snowflake', '{}', null),
  ('shopify', 'Shopify', '{}', null),
  ('dropbox', 'Dropbox', '{}', null),
  ('pinterest', 'Pinterest', '{}', null),
  ('intuit', 'Intuit', '{}', null),
  ('paypal', 'PayPal', '{}', null),
  ('phonepe', 'PhonePe', '{}', null),
  ('canva', 'Canva', '{}', null),
  ('grab', 'Grab', '{}', null),
  ('gitlab', 'GitLab', '{}', null),
  ('cloudflare', 'Cloudflare', '{}', null),
  ('twilio', 'Twilio', '{}', null),
  ('datadog', 'Datadog', '{}', null),
  ('mongodb', 'MongoDB', '{}', null),
  ('elastic', 'Elastic', '{}', null),
  ('jetbrains', 'JetBrains', '{}', null),
  ('wise', 'Wise', '{"transferwise"}', null),
  ('ola', 'Ola', '{}', null),
  ('postman', 'Postman', '{}', null),
  ('browserstack', 'BrowserStack', '{}', null),
  ('inmobi', 'InMobi', '{}', null),
  ('myntra', 'Myntra', '{}', null),
  ('bloomberg', 'Bloomberg', '{"bloomberg lp"}', null),
  ('coinbase', 'Coinbase', '{}', null),
  ('doordash', 'DoorDash', '{}', null),
  ('lyft', 'Lyft', '{}', null),
  ('intel', 'Intel', '{"intel corporation"}', null),
  ('qualcomm', 'Qualcomm', '{}', null),
  ('cisco', 'Cisco', '{"cisco systems"}', null),
  ('servicenow', 'ServiceNow', '{}', null),
  ('workday', 'Workday', '{}', null),
  ('ebay', 'eBay', '{}', null),
  ('expedia', 'Expedia', '{"expedia group"}', null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill the rows that already exist
--
-- Correct rather than fast: the library is small, and every step is written to give the
-- same answer the new write path would. It is also a bridge rather than the last word --
-- every fetched source is re-read by extractor version 2 on the next refresh, which
-- replaces these reports with ones extracted in the new shape.
-- ---------------------------------------------------------------------------

-- 1. Companies for every employer name already in the library that we do not have.
--    Names are resolved exactly as the API resolves them (whitespace collapsed, case
--    ignored, name or alias, never fuzzy), and group names are not employers.
do $$
declare
  legacy record;
  base_slug text;
  candidate_slug text;
  attempt integer;
  -- Mirrors EmployerNames.GROUPS and EmployerNames.GROUP_WORDS in the API, and
  -- `EmployerNamesTest` checks that the two lists are the same.
  groups text[] := array[
    -- employer-groups:begin
    'big tech', 'big 4', 'big four', 'big 3', 'big three', 'mbb', 'fortune 500',
    'fortune 100', 'product companies', 'product company', 'product based companies',
    'product based company', 'service companies', 'service based companies',
    'service based company', 'it companies', 'mnc', 'mncs', 'startup', 'startups',
    'a startup', 'unicorn', 'unicorns', 'tech companies', 'top tech companies',
    'tech giants', 'top companies', 'tier 1 companies', 'various companies',
    'multiple companies', 'several companies', 'many companies', 'the company', 'company',
    'companies', 'unknown', 'not specified', 'unspecified', 'undisclosed', 'confidential',
    'anonymous', 'n a', 'na', 'none'
    -- employer-groups:end
  ];
  group_words text[] := array[
    -- employer-group-words:begin
    'faang', 'maang', 'manga', 'gafam', 'gafa'
    -- employer-group-words:end
  ];
  normalised text;
begin
  for legacy in
    select distinct btrim(regexp_replace(n, '[\x09-\x0d\x20]+', ' ', 'g')) as name
      from (
        select company_name as n from public.interview_sources
        union all
        select company_name from public.source_questions
      ) names
     where n is not null
       and btrim(regexp_replace(n, '[\x09-\x0d\x20]+', ' ', 'g')) <> ''
  loop
    normalised := btrim(regexp_replace(lower(legacy.name), '[^a-z0-9]+', ' ', 'g'));
    continue when normalised = any (groups)
               or string_to_array(normalised, ' ') && group_words
               or length(legacy.name) > 80;

    continue when exists (
      select 1
        from public.companies c
       where lower(c.name) = lower(legacy.name)
          or lower(legacy.name) = any (c.aliases)
    );

    base_slug := btrim(regexp_replace(lower(legacy.name), '[^a-z0-9]+', '-', 'g'), '-');
    if base_slug = '' then
      base_slug := 'company-' || substr(md5(legacy.name), 1, 8);
    end if;
    base_slug := left(base_slug, 60);
    base_slug := btrim(base_slug, '-');

    attempt := 1;
    loop
      candidate_slug := case when attempt = 1 then base_slug else base_slug || '-' || attempt end;
      insert into public.companies (slug, name)
      values (candidate_slug, legacy.name)
      on conflict do nothing;
      exit when found;
      attempt := attempt + 1;
      -- A slug clash with a different employer is rare; a hundred of them is a bug.
      if attempt > 100 then
        raise exception 'Could not find a free slug for company %', legacy.name;
      end if;
    end loop;
  end loop;
end
$$;

-- 2. Each legacy report's company: the name the question gave, else the source's declared
--    company -- the same fallback the extractor now applies. Name match beats alias match.
update public.source_questions q
   set company_id = (
     select c.id
       from public.companies c
      where lower(c.name) = lower(btrim(regexp_replace(coalesce(q.company_name, s.company_name), '[\x09-\x0d\x20]+', ' ', 'g')))
         or lower(btrim(regexp_replace(coalesce(q.company_name, s.company_name), '[\x09-\x0d\x20]+', ' ', 'g'))) = any (c.aliases)
      order by (lower(c.name) = lower(btrim(regexp_replace(coalesce(q.company_name, s.company_name), '[\x09-\x0d\x20]+', ' ', 'g')))) desc,
               c.created_at,
               c.id
      limit 1
   )
  from public.interview_sources s
 where s.id = q.source_id
   and q.company_id is null
   and coalesce(q.company_name, s.company_name) is not null;

-- 3. One bank question per distinct fingerprint, worded as the earliest report worded it,
--    with the first round type any report gave. Pure-punctuation text has no fingerprint
--    and stays out of the bank.
insert into public.bank_questions (text, round_type, created_at)
select first_report.text,
       (
         select q2.round_type
           from public.source_questions q2
          where public.question_fingerprint(q2.question_text) = first_report.fingerprint
            and q2.round_type is not null
          order by q2.created_at, q2.id
          limit 1
       ),
       first_report.created_at
  from (
    select distinct on (public.question_fingerprint(q.question_text))
           public.question_fingerprint(q.question_text) as fingerprint,
           btrim(regexp_replace(q.question_text, '[\x09-\x0d\x20]+', ' ', 'g')) as text,
           q.created_at
      from public.source_questions q
     where public.question_fingerprint(q.question_text) <> ''
     order by public.question_fingerprint(q.question_text), q.created_at, q.id
  ) first_report
on conflict (fingerprint) do nothing;

-- 4. Point every legacy report at its bank question.
update public.source_questions q
   set bank_question_id = b.id
  from public.bank_questions b
 where b.fingerprint = public.question_fingerprint(q.question_text)
   and q.bank_question_id is null;

-- ---------------------------------------------------------------------------
-- Row-level security: the library's posture
--
-- Operator data, not candidate data. No client policy grants access; the API reads as
-- the database owner and serves the bank only to signed-in candidates, through its own
-- endpoints. The view above is security_invoker, so it inherits exactly this.
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.bank_questions enable row level security;

comment on table public.companies is
  'Employers, with the exact other names each goes by. Never a subsidiary, region or '
  'division as an alias: "Google Cloud India" is not Google.';

comment on table public.bank_questions is
  'One row per distinct reported question. Only the extractor writes here, from fetched '
  'sources; questions a model wrote never enter the bank. Company tags are derived from '
  'source_questions via bank_question_tags, never stored.';
