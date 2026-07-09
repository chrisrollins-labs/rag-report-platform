-- 0008 — billing: user-owned entitlements + an idempotent webhook ledger
-- (ADR-011).
--
-- Two ownership models in one migration. Customer and subscription rows are
-- user-owned and readable by their owner under RLS. The webhook-event ledger
-- is internal and service-only; it is what makes webhook processing idempotent
-- — an event id is recorded once, and re-deliveries are no-ops.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_subscription_id text not null unique,
  status text not null,
  plan text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index subscriptions_owner on public.subscriptions (owner_id);

-- Idempotency ledger: the provider's event id is the primary key, so recording
-- an already-seen event conflicts and the handler treats it as a duplicate.
create table public.webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- User-owned rows: the owner can read their own; writes go through the
-- service role in webhook handlers.
alter table public.customers enable row level security;
create policy customers_owner_read on public.customers
  for select using (owner_id = app_current_user_id());

alter table public.subscriptions enable row level security;
create policy subscriptions_owner_read on public.subscriptions
  for select using (owner_id = app_current_user_id());

-- Internal ledger: service-only.
alter table public.webhook_events enable row level security;
create policy webhook_events_service_only on public.webhook_events
  using (false) with check (false);
