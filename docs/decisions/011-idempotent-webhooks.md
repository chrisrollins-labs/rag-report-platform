# 011 — Idempotent webhooks via an event-id ledger

**Status:** Accepted

## Context

Payment and integration providers deliver webhooks at-least-once and out of
order. A handler that assumes exactly-once, in-order delivery will double-apply
effects or corrupt state under normal provider behavior.

## Decision

Two rules. First, idempotency: record the provider's event id in a ledger
(`webhook_events`, event id as primary key); a re-delivered event conflicts and
is treated as a duplicate no-op. Second, self-derivation: each handler derives
state from the event's own object and upserts by the resource's provider id, so
out-of-order deliveries converge on the correct final state. Effects that reach
other systems are returned as intents and dispatched after commit, so an
outbound failure never fails the webhook.

## Consequences

- Re-deliveries and reordering are harmless by construction.
- The handler is pure and testable: given an event, it produces a deterministic
  state change and a set of side-effect intents.
- Deriving from the event's own payload means a slightly stale event cannot
  overwrite newer state with older values, at the cost of ignoring the tempting
  shortcut of trusting delivery order.
