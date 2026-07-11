# 007 — RLS in the same migration as each table, gated in CI

**Status:** Accepted

## Context

Multi-tenant isolation enforced only in application code is one forgotten
`where` clause from a breach. Row-Level Security pushes isolation into the
database, but only if every table actually has a policy — and "add policies
later" is exactly how a table ships without one.

## Decision

Enable RLS and write its policies in the **same migration** that creates each
table. A CI gate (`scripts/check-rls-coverage.mjs`) statically parses the
migrations and fails the build if any table in an application schema lacks RLS
or a policy. Internal tables get a deny-by-default policy (`using (false)`);
user-owned tables scope to `app_current_user_id()`.

## Consequences

- Isolation is structural and provably present, not aspirational.
- The check runs with no database — it reads SQL — so it is fast and always on.
- A table that legitimately needs an exception goes on an explicit, documented
  allowlist; a silent skip is never allowed.
