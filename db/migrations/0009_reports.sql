-- 0009 — user-facing report requests.
--
-- The user-owned record of a generated report. It references the shared L1
-- base by cache_key (the durable content is deduplicated across users; the
-- per-user row records who asked for what and when). RLS scopes reads and
-- writes to the owner.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subject text not null,
  region text not null,
  period text not null,
  target_date date not null,
  base_cache_key text,
  status text not null default 'pending',
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index reports_owner_created on public.reports (owner_id, created_at desc);

alter table public.reports enable row level security;
create policy reports_owner_select on public.reports
  for select using (owner_id = app_current_user_id());
create policy reports_owner_insert on public.reports
  for insert with check (owner_id = app_current_user_id());
create policy reports_owner_update on public.reports
  for update using (owner_id = app_current_user_id());
