-- One test candidate, loaded into the local Supabase stack by `npm run db:reset`.
--
-- Local only. Never run this against the hosted project: there, users are created by
-- signing in with Google, and a hand-inserted auth.users row is an account Supabase
-- Auth does not fully own.
--
-- Idempotent, so a partial reset can be re-run safely.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'test.candidate@example.com',
  '{"provider": "google", "providers": ["google"]}'::jsonb,
  '{"full_name": "Test Candidate"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.users (id, email, display_name, preferred_language)
values (
  '00000000-0000-4000-8000-000000000001',
  'test.candidate@example.com',
  'Test Candidate',
  'hindi_english'
)
on conflict (id) do update
   set display_name = excluded.display_name,
       preferred_language = excluded.preferred_language;

insert into public.profiles (
  user_id,
  function,
  current_level,
  target_level,
  total_experience_months,
  location,
  relocation_intent,
  work_authorisation_status,
  notice_period_days,
  compensation_expectation_min,
  compensation_expectation_max,
  compensation_currency
)
values (
  '00000000-0000-4000-8000-000000000001',
  'backend_engineering',
  'senior',
  'staff',
  84,
  'Bengaluru, India',
  'open_internationally',
  'requires_sponsorship',
  60,
  4000000.00,
  5000000.00,
  'INR'
)
on conflict (user_id) do nothing;
