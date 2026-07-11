# 009 — Graceful-empty RAG with a coverage-gap demand signal

**Status:** Accepted

## Context

Retrieval depends on an embedding call and a populated corpus, both of which can
be absent: no API key yet, an empty corpus for a new subject, or a transient
failure. If any of those hard-fails generation, the product breaks for exactly
the requests a growing corpus has not caught up to.

## Decision

Retrieval is graceful-empty: no key, no matches, or any error returns an empty
knowledge block and generation proceeds unaided. Separately, when a real request
retrieves zero chunks for its subject and region, it records a
`knowledge_coverage_gap` event. That event stream is the demand signal that
tells corpus expansion what to prioritize — by what is actually being asked for,
not by guesswork.

## Consequences

- A thin or missing corpus degrades quality, never availability.
- Corpus growth is driven by measured demand, turning a gap into a work item
  instead of a silent quality hole.
- Empty retrieval must be visibly distinct from good retrieval in the output, so
  a degraded answer is never mistaken for a fully grounded one.
