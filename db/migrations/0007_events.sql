-- 0007 — first-party event log.
--
-- A minimal analytics sink. The one event that matters for the engine is
-- 'knowledge_coverage_gap': a real request hit a subject/region with no
-- retrievable chunks, which is the demand signal that prioritizes corpus
-- expansion by what is actually being asked for (ADR-009).

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  user_id uuid,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_name_created on public.events (name, created_at desc);

alter table public.events enable row level security;
create policy events_service_only on public.events
  using (false) with check (false);
