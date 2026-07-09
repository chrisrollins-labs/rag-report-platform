import { logger } from "@/observability/logger";
import { toEntitlementStatus } from "./entitlements";
import type { BillingStore, SubscriptionRecord } from "./store";

/**
 * Idempotent webhook processing (ADR-011). Two rules make delivery order and
 * re-delivery harmless:
 *
 *   1. Idempotency: the event id is recorded once; a duplicate is a no-op.
 *   2. Self-derivation: each handler derives state from the event's OWN object
 *      and upserts by subscription id, so out-of-order deliveries converge on
 *      the correct final state rather than corrupting it.
 *
 * Side effects that reach OTHER systems (email, analytics) are intentionally
 * not done here — they would be returned as intents for the caller to dispatch
 * after the transaction, so an outbound hiccup never fails the webhook.
 */

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export interface BillingEvent {
  id: string;
  type: string;
  subscription?: {
    id: string;
    ownerId: string;
    status: string;
    paused?: boolean;
    plan?: string;
    currentPeriodEnd?: string;
  };
}

const HANDLED_TYPES = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.deleted",
]);

export async function processWebhookEvent(
  store: BillingStore,
  event: BillingEvent,
): Promise<WebhookOutcome> {
  if (!HANDLED_TYPES.has(event.type)) return "ignored";

  const { firstTime } = await store.markEventProcessed(event.id, event.type);
  if (!firstTime) return "duplicate";

  if (event.subscription) {
    const providerStatus =
      event.type === "subscription.deleted" ? "canceled" : event.subscription.status;
    const record: SubscriptionRecord = {
      id: event.subscription.id,
      ownerId: event.subscription.ownerId,
      status: toEntitlementStatus(providerStatus, event.subscription.paused),
      ...(event.subscription.plan ? { plan: event.subscription.plan } : {}),
      ...(event.subscription.currentPeriodEnd
        ? { currentPeriodEnd: event.subscription.currentPeriodEnd }
        : {}),
    };
    await store.upsertSubscription(record);
    logger.info("subscription updated from webhook", { id: record.id, status: record.status });
  }

  return "processed";
}
