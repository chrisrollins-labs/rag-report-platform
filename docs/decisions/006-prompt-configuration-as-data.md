# 006 — Prompt configuration as versioned, audited data

**Status:** Accepted

## Context

Prompts and model choices change often and have outsized effects on output
quality and cost. If they live in application code, every wording tweak is a
deploy, there is no record of what produced a past result, and rolling back
means a revert-and-redeploy.

## Decision

Store prompt configuration — task, model id, parameters, and templates — in a
`prompt_configs` table, one active row per task. Every write lands a row in
`prompt_config_history` via a trigger. The AI client loads the active config by
task at request time; app code never hardcodes a model id or a prompt string.

## Consequences

- A prompt or model change is a reviewable, revertable data change, and the
  exact configuration behind any past output can be reconstructed from history.
- The eval harness (ADR-010) grades a specific config version, so quality
  changes are attributable.
- Configuration is now operational data that must be seeded and migrated; the
  reference impl ships a default config in code to keep the path self-contained,
  with the table as the production source.
