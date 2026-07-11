# 012 — Migrations as the single source of schema truth

**Status:** Accepted

## Context

When schema can change from a dashboard, a console, or ad hoc SQL, environments
drift, and "what is the schema" becomes a question no artifact answers. Drift
surfaces as works-in-staging-fails-in-prod.

## Decision

The only way schema changes is an appended, ordered migration file under
`db/migrations`. No dashboard edits. A CI gate
(`scripts/check-migration-order.mjs`) enforces that migrations are appended with
strictly increasing, unique numeric prefixes, so a lower-numbered migration
cannot be slipped in after peers have applied higher ones.

## Consequences

- The migration history IS the schema; any environment is a replay of the same
  ordered files.
- Review happens on schema changes like any other code.
- Emergency hotfixes must still go through a migration, which is slower than a
  console edit in the moment but is what keeps environments identical.
