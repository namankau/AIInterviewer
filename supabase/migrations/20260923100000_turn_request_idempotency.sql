-- One answer and one hint can be accepted for a turn. Claims stop concurrent retries
-- before model spend; leases let a later request recover after a crashed worker.
alter table public.session_turns
  add column answer_request_id uuid,
  add column answer_request_lease_until timestamptz,
  add column answer_response jsonb,
  add column hint_request_id uuid,
  add column hint_request_lease_until timestamptz,
  add column hint_response jsonb;

alter table public.session_turns
  add constraint answer_response_has_request
    check (answer_response is null or answer_request_id is not null),
  add constraint hint_response_has_request
    check (hint_response is null or hint_request_id is not null);
