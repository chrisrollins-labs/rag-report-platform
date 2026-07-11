# Prompt versioning

Prompts and model choices are configuration, not code (ADR-006).

## Shape

A prompt config is a row: task, model id, parameters, a system template, and a
user template. Templates use `{{variable}}` placeholders filled at render time
(`src/ai/templates.ts`). One config is active per task.

## Lifecycle

A change is an INSERT or UPDATE, captured by a trigger into
`prompt_config_history`. The AI client loads the active config for a task at
request time and never sees a hardcoded model id or prompt string. Rolling back
is re-activating a prior version, not a code revert.

## Why it matters

- The exact configuration behind any past output is reconstructable.
- The eval harness (ADR-010) grades a specific version, so a quality change is
  attributable to a specific config.
- A wording tweak does not require a deploy.

In this reference implementation the active config ships in code
(`src/reports/prompts.ts`, `evals/judge.ts`) so the path is self-contained; the
table is the production source, and the shape is identical.
