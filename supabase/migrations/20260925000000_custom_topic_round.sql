alter type public.round_type add value if not exists 'custom_topic';

alter table public.sessions
  add column if not exists focus_topic text;

alter table public.sessions
  drop constraint if exists sessions_focus_topic_check;

alter table public.sessions
  add constraint sessions_focus_topic_check check (
    focus_topic is null or length(btrim(focus_topic)) between 1 and 160
  );

comment on column public.sessions.focus_topic is
  'Candidate-chosen scope for a custom-topic interview round; null for standard rounds.';
