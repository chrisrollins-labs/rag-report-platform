import { describe, expect, it } from "vitest";
import { InMemoryBillingStore } from "@/billing/store";
import { processWebhookEvent, type BillingEvent } from "@/billing/webhook";

const event = (over: Partial<BillingEvent> = {}): BillingEvent => ({
  id: "evt_1",
  type: "subscription.created",
  subscription: { id: "sub_1", ownerId: "user_1", status: "active", plan: "pro" },
  ...over,
});

describe("processWebhookEvent", () => {
  it("processes a handled event once and upserts the subscription", async () => {
    const store = new InMemoryBillingStore();
    const outcome = await processWebhookEvent(store, event());

    expect(outcome).toBe("processed");
    const sub = await store.getSubscription("sub_1");
    expect(sub).toMatchObject({ ownerId: "user_1", status: "active", plan: "pro" });
  });

  it("is idempotent: a re-delivered event id is a no-op", async () => {
    const store = new InMemoryBillingStore();
    const first = await processWebhookEvent(store, event());
    const second = await processWebhookEvent(store, event({ subscription: { id: "sub_1", ownerId: "user_1", status: "canceled" } }));

    expect(first).toBe("processed");
    expect(second).toBe("duplicate");
    // The duplicate did not overwrite the subscription with its stale payload.
    expect((await store.getSubscription("sub_1"))?.status).toBe("active");
  });

  it("ignores unhandled event types", async () => {
    const store = new InMemoryBillingStore();
    expect(await processWebhookEvent(store, event({ type: "invoice.created" }))).toBe("ignored");
  });

  it("maps a deletion event to a canceled entitlement", async () => {
    const store = new InMemoryBillingStore();
    await processWebhookEvent(store, event({ id: "evt_2", type: "subscription.deleted" }));
    expect((await store.getSubscription("sub_1"))?.status).toBe("canceled");
  });
});
