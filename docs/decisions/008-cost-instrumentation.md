# 008 — Cost instrumentation on every model call

**Status:** Accepted

## Context

AI features have a per-request marginal cost that is easy to lose track of and
expensive to reconstruct after the fact. "What does a report cost us?" should
be a query, not an investigation.

## Decision

Every model call emits a **usage record** — task, model, token counts, latency,
and estimated USD cost — through a single `UsageSink`, on both success and
failure. Because all model calls go through one client (ADR-001), there is
exactly one place this happens. Production writes the record to an
`ai_usage_log` table; tests use an in-memory sink and assert on it.

## Consequences

- Cost-per-report, cost-per-task, and failure rates are all straightforward
  aggregations.
- Estimation depends on a price table that must track the provider's published
  pricing; a missing entry under-reports (estimates 0) rather than throwing, so
  a pricing gap never breaks a report.
- Failure records carry zero tokens and the error, so spend and reliability
  live in the same place.
