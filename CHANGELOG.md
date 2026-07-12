# Changelog

All notable changes to this reference implementation are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/), and the project
uses Conventional Commits.

## [0.1.0]

Initial reference implementation.

### AI core
- Provider abstraction with an injectable transport (ADR-001).
- Structured output via Zod with one corrective retry (ADR-005).
- Per-call usage logging and cost estimation (ADR-008).
- Prompt configuration as versioned, audited data (ADR-006).

### Report engine
- L1 durable base cache with a double-generation lock (ADR-003).
- L2 live overlay with a deterministic fallback (ADR-004).
- Pipeline orchestrator with honest failure handling and provenance.

### Retrieval
- pgvector corpus with an HNSW index and a `match_chunks` function (ADR-002).
- Graceful-empty retrieval with a coverage-gap demand signal (ADR-009).
- Chunking and a corpus-seeding CLI with an offline dry-run.

### Signals
- `SignalProvider` seam with a deterministic temporal provider and a
  network-backed weather provider, each optional.

### Data + security
- Migrations as the single source of schema truth (ADR-012).
- RLS enabled in the same migration as each table, gated in CI (ADR-007).
- Secrets policy with gitleaks and an `.env.example` guard test.

### Billing
- Idempotent webhook processing via an event-id ledger (ADR-011).
- Entitlement mapping that fails closed.

### Evaluation
- LLM-as-judge harness against a committed golden set (ADR-010).

### Tooling
- CI: typecheck, lint, test, RLS coverage, migration order, build, secret scan,
  CodeQL.
- Offline test suite (54 tests) covering every core module.
