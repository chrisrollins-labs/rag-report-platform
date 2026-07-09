/**
 * Entitlement mapping. Provider subscription statuses are collapsed into the
 * small set the app actually branches on, in one place, so access checks never
 * re-derive the rules ad hoc. Access is granted for active and trialing only;
 * everything else is treated as no access, failing closed.
 */

export type EntitlementStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";

export function toEntitlementStatus(providerStatus: string, paused = false): EntitlementStatus {
  if (paused) return "paused";
  switch (providerStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      // incomplete, incomplete_expired, canceled, paused → no grant.
      return "canceled";
  }
}

export function hasActiveAccess(status: EntitlementStatus): boolean {
  return status === "active" || status === "trialing";
}
