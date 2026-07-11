# 003 — Layered report cache with a double-generation lock

**Status:** Accepted

## Context

Generating a report with a model is slow and costs money. Most requests for the
"same" report (same subject, region, period) should not each pay that cost.
And when two such requests arrive at once against a cold cache, a naive design
generates twice.

## Decision

Split the report into a **durable base** (a pure function of the inputs that
determine long-lived content) and **live layers** (signals, and in the full
build a live-conditions overlay). Cache the base by a normalized key. On a
miss, a **guarded insert** (`ON CONFLICT DO NOTHING` in Postgres; a Map check
in the in-memory store) makes exactly one caller the generation owner;
concurrent callers poll until it finishes. Reclaim stale-`generating` rows (a
crashed owner) and failed rows on the next request.

## Consequences

- The expensive model call happens once per key; the warm path is store-only.
- Correctness under concurrency without a distributed lock service — the
  database's own conflict handling is the lock.
- The key must exclude fast-moving inputs, or the cache never hits. Those
  inputs are pushed to the live layers by design.
