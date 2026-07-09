import { describe, expect, it } from "vitest";
import { hasActiveAccess, toEntitlementStatus } from "@/billing/entitlements";

describe("toEntitlementStatus", () => {
  it("maps provider statuses to the app's entitlement set", () => {
    expect(toEntitlementStatus("active")).toBe("active");
    expect(toEntitlementStatus("trialing")).toBe("trialing");
    expect(toEntitlementStatus("past_due")).toBe("past_due");
    expect(toEntitlementStatus("unpaid")).toBe("past_due");
    expect(toEntitlementStatus("incomplete")).toBe("canceled");
    expect(toEntitlementStatus("active", true)).toBe("paused");
  });
});

describe("hasActiveAccess", () => {
  it("grants access for active and trialing, and fails closed otherwise", () => {
    expect(hasActiveAccess("active")).toBe(true);
    expect(hasActiveAccess("trialing")).toBe(true);
    expect(hasActiveAccess("past_due")).toBe(false);
    expect(hasActiveAccess("paused")).toBe(false);
    expect(hasActiveAccess("canceled")).toBe(false);
  });
});
