-- 0003 — cost instrumentation ledger (ADR-008).
--
-- One row per model call, success or failure. Because every call goes through
-- one client (ADR-001), this is the single place spend is recorded, so
-- cost-per-report and failure rates are ordinary aggregations.

create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  model text not null,
  prompt_config_id uuid,
  report_base_key text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  est_cost_usd numeric(12, 6) not null default 0,
  success boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);

create index ai_usage_log_task_created on public.ai_usage_log (task, created_at desc);

alter table public.ai_usage_log enable row level security;
create policy ai_usage_log_service_only on public.ai_usage_log
  using (false) with check (false);
