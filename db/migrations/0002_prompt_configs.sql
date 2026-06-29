-- 0002 — prompt configuration as versioned, audited data (ADR-006).
--
-- Model id, parameters, and templates live in the database, not in app code.
-- A change is an INSERT/UPDATE captured by the history trigger, so every
-- wording or model swap is reviewable and revertable. One active config per
-- task is enforced by a partial unique index.

create table public.prompt_configs (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  model text not null,
  system_template text not null,
  user_template text not null,
  params jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index prompt_configs_one_active_per_task
  on public.prompt_configs (task)
  where is_active;

create table public.prompt_config_history (
  id uuid primary key default gen_random_uuid(),
  prompt_config_id uuid not null,
  task text not null,
  model text not null,
  params jsonb not null,
  changed_at timestamptz not null default now()
);

-- Audit trigger: every write to a prompt config lands a history row, so the
-- exact configuration used to produce any past output can be reconstructed.
create or replace function record_prompt_config_history() returns trigger
  language plpgsql
as $$
begin
  insert into public.prompt_config_history (prompt_config_id, task, model, params)
  values (new.id, new.task, new.model, new.params);
  return new;
end;
$$;

create trigger prompt_configs_history
  after insert or update on public.prompt_configs
  for each row execute function record_prompt_config_history();

-- Internal tables: service-role only. RLS on, deny-by-default policy.
alter table public.prompt_configs enable row level security;
create policy prompt_configs_service_only on public.prompt_configs
  using (false) with check (false);

alter table public.prompt_config_history enable row level security;
create policy prompt_config_history_service_only on public.prompt_config_history
  using (false) with check (false);
