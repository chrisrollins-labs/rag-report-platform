-- 0005 — conditions cache for signals and the live overlay (ADR-003, ADR-004).
--
-- Signal snapshots and overlay results are cached per (location, data_type)
-- with a TTL, so repeat requests inside the window stay pure-DB and never
-- re-hit an external feed or the overlay model.

create table public.conditions_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  data_type text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (cache_key, data_type)
);

create index conditions_cache_expiry on public.conditions_cache (expires_at);

alter table public.conditions_cache enable row level security;
create policy conditions_cache_service_only on public.conditions_cache
  using (false) with check (false);
