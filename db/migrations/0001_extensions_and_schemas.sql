-- 0001 — extensions, schemas, and the tenancy helper.
--
-- Migrations are the single source of schema truth (ADR-012): every schema
-- change is an appended, ordered SQL file, applied in filename order, never a
-- dashboard edit. This first migration establishes the vector extension, the
-- rag schema, and the GUC-based tenancy helper the RLS policies build on.

create extension if not exists vector;

create schema if not exists rag;

-- Tenancy model (ADR-007): the app sets a per-request GUC to the authenticated
-- user id, and RLS policies compare against it. Internal tables have no user
-- and are service-role only (deny-by-default policy). Keeping this in one
-- helper means the policies read the same everywhere.
create or replace function app_current_user_id() returns uuid
  language sql stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;
