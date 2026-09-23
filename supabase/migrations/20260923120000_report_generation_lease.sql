alter table public.sessions
  add column report_generation_lease_id uuid,
  add column report_generation_lease_until timestamptz,
  add constraint report_generation_lease_is_complete
    check (
      (report_generation_lease_id is null and report_generation_lease_until is null)
      or
      (report_generation_lease_id is not null and report_generation_lease_until is not null)
    );
