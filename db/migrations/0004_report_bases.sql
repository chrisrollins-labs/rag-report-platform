-- 0004 — the L1 durable report cache (ADR-003).
--
-- Keyed by the inputs that determine durable content. The status column plus
-- the unique key drive the cache state machine: a guarded insert
-- (ON CONFLICT DO NOTHING) makes exactly one concurrent request the generation
-- owner; others poll. Stale 'generating' rows are reclaimed after a timeout.

create type report_base_status as enum ('generating', 'ready', 'failed');

create table public.report_bases (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  status report_base_status not null default 'generating',
  content jsonb,
  model text,
  prompt_config_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index report_bases_status on public.report_bases (status);

-- Shared cache, written and read by the service role in the pipeline. Not
-- user-owned, so service-only RLS.
alter table public.report_bases enable row level security;
create policy report_bases_service_only on public.report_bases
  using (false) with check (false);
