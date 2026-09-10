-- A round may be as short as five minutes.
--
-- The floor was ten, which is a sensible minimum for a round somebody is actually
-- practising for and a bad one for the owner checking that a room works at all. Testing
-- the DSA editor or the design canvas meant sitting a ten-minute round every time, so the
-- floor is lowered rather than the check removed: five minutes is long enough to exercise
-- the opening, one exchange and the close, and short enough to do repeatedly.
--
-- The default stays 40. This widens what is allowed; it does not change what is normal.
--
-- The old constraint is found rather than named. It was created inline by `add column ...
-- check (...)`, so its name is whatever Postgres chose at the time. `drop constraint if
-- exists <guess>` would silently do nothing if that guess were wrong, leaving the ten
-- minute floor in force behind a migration that claimed to have removed it — the failure
-- would surface as a confusing 400 on the first five minute round, not here.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'sessions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%duration_minutes%'
  loop
    execute format('alter table public.sessions drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.sessions
  add constraint sessions_duration_minutes_check
    check (duration_minutes between 5 and 120);

comment on column public.sessions.duration_minutes is
  'How long the round is scheduled to run. The clock, not a turn counter, ends the '
  'interview. Five minutes is the testing floor; real rounds are 20 minutes and up.';
