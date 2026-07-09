/**
 * Billing persistence seam (ADR-011). The idempotency guarantee lives in
 * `markEventProcessed`: it records the provider's event id once and reports
 * whether this was the first time, so a re-delivered webhook is a no-op. The
 * in-memory implementation is for tests; production backs it with the
 * webhook_events and subscriptions tables.
 */

export interface SubscriptionRecord {
  id: string;
  ownerId: string;
  status: string;
  plan?: string;
  currentPeriodEnd?: string;
}

export interface BillingStore {
  /** Insert the event id; firstTime=false means it was already processed. */
  markEventProcessed(eventId: string, eventType: string): Promise<{ firstTime: boolean }>;
  upsertSubscription(sub: SubscriptionRecord): Promise<void>;
  getSubscription(id: string): Promise<SubscriptionRecord | null>;
}

export class InMemoryBillingStore implements BillingStore {
  private readonly events = new Set<string>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();

  async markEventProcessed(eventId: string): Promise<{ firstTime: boolean }> {
    if (this.events.has(eventId)) return { firstTime: false };
    this.events.add(eventId);
    return { firstTime: true };
  }

  async upsertSubscription(sub: SubscriptionRecord): Promise<void> {
    this.subscriptions.set(sub.id, sub);
  }

  async getSubscription(id: string): Promise<SubscriptionRecord | null> {
    return this.subscriptions.get(id) ?? null;
  }
}
