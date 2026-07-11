# 001 — AI provider abstraction

**Status:** Accepted

## Context

Model calls sprawl across a codebase by default: some in generation, some in
retrieval, some in evaluation. Sprawl means scattered retry logic, no single
place to account for cost, and a painful vendor migration. Tests that call real
APIs are slow, flaky, and expensive.

## Decision

Every model call goes through one function that takes an **injectable
transport** (`GenerateFn`). Production wires an OpenAI-compatible transport over
`fetch`; tests wire a scripted mock. The function renders the prompt template,
calls the transport, and logs a usage record on both the success and failure
paths.

## Consequences

- One place to change providers, one place for retry and cost policy.
- The entire test suite runs offline with no key.
- The cost is a small indirection and the discipline never to bypass it. A lint
  rule can harden the "no direct provider calls" boundary if the team grows.
