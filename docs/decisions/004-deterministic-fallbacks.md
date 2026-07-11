# 004 — Deterministic fallbacks for every model- and network-dependent path

**Status:** Accepted

## Context

LLM providers and third-party data feeds have outages, rate limits, and latency
spikes. If a report cannot render without a live model call or a specific feed,
then a vendor's availability becomes the product's availability. That is
unacceptable for a system whose whole value is the report the user came to get.

## Decision

Every model- or network-dependent enhancement has a fallback:

- **Retrieval** returns empty on any error; generation proceeds unaided.
- **Each signal provider** returns null independently and is absent from the
  result rather than fatal.
- **At least one signal provider is deterministic** (pure computation, no
  network), so the conditions section is never empty.
- In the full build, the **live overlay** falls back to a template built from
  raw signal data when the overlay model call fails.

## Consequences

- A degraded report instead of no report.
- Fallback code is extra surface to maintain and test, and it must stay honest:
  a fallback that silently pretends to be a full result is worse than an error.
  Every degradation is recorded in the report's provenance (`missingSignals`,
  cache flags).
