# 005 — Structured output via Zod with one corrective retry

**Status:** Accepted

## Context

Free-text model output is unusable downstream without parsing, and models
occasionally wrap JSON in prose or fences, or drop a required field. The legacy
approach — parse, then regex-repair, then hope — is fragile and hides genuinely
broken prompts behind lucky repairs.

## Decision

Ask the model for JSON, extract the first balanced object (tolerating fences),
and validate it against a **Zod schema**. On a validation miss, retry **once**
with a corrective suffix that tells the model exactly what went wrong. If the
retry also fails, throw a `ValidationError` — loudly, not silently.

## Consequences

- Downstream code receives a typed, validated object and can be total (no
  optional-chaining spelunking).
- One retry absorbs transient formatting slips without masking a broken prompt:
  a prompt that fails twice is a real signal, surfaced immediately.
- Two attempts cap the worst-case latency and cost at 2x, both cost-logged.
