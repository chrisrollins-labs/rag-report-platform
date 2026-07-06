import { describe, expect, it } from "vitest";
import { MockTransport, failingTransport } from "@/ai/providers/mock";
import { InMemoryUsageSink } from "@/ai/usage-log";
import { InMemoryConditionsCache } from "@/reports/conditions-cache";
import { deterministicOverlay, getOverlay, overlayApplies } from "@/reports/overlay";
import type { SignalSnapshot } from "@/signals/snapshot";
import { VALID_ADVISORY } from "../helpers/fixtures";
import { VALID_OVERLAY_JSON } from "../helpers/fixtures";

const NOW = () => new Date("2026-10-14T12:00:00Z");
const SNAPSHOT: SignalSnapshot = {
  results: {
    temporal: { provider: "temporal", summary: "autumn conditions.", data: { season: "autumn" } },
  },
  missing: [],
};

function overlayDeps(transport: MockTransport | ReturnType<typeof failingTransport>) {
  const generate = transport instanceof MockTransport ? transport.generate : transport;
  return {
    ai: { generate, sink: new InMemoryUsageSink() },
    cache: new InMemoryConditionsCache(() => NOW().getTime()),
    now: NOW,
  };
}

const ARGS = {
  base: VALID_ADVISORY,
  baseKey: "k1",
  region: "central gulf coast",
  targetDate: "2026-10-15",
  snapshot: SNAPSHOT,
};

describe("overlayApplies", () => {
  it("is true inside the window, false outside it", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(overlayApplies("2026-10-15", now)).toBe(true);
    expect(overlayApplies("2026-10-14", now)).toBe(true);
    expect(overlayApplies("2026-12-01", now)).toBe(false); // beyond 7 days
    expect(overlayApplies("2026-10-01", now)).toBe(false); // in the past
  });
});

describe("getOverlay", () => {
  it("returns null (not applicable) for a far-future date", async () => {
    const result = await getOverlay(overlayDeps(new MockTransport([VALID_OVERLAY_JSON])), {
      ...ARGS,
      targetDate: "2027-01-01",
    });
    expect(result).toEqual({ overlay: null, cacheHit: null });
  });

  it("generates and caches an overlay inside the window", async () => {
    const deps = overlayDeps(new MockTransport([VALID_OVERLAY_JSON]));
    const first = await getOverlay(deps, ARGS);
    const second = await getOverlay(deps, ARGS);

    expect(first.cacheHit).toBe(false);
    expect(first.overlay?.today_outlook).toContain("hold steady");
    expect(second.cacheHit).toBe(true); // served from cache, no second model call
  });

  it("degrades to a deterministic overlay when the model fails", async () => {
    const result = await getOverlay(overlayDeps(failingTransport("model down")), ARGS);
    expect(result.cacheHit).toBe(false);
    expect(result.overlay?.today_outlook).toContain("autumn conditions.");
    expect(result.overlay?.highlights).toEqual([]);
  });
});

describe("deterministicOverlay", () => {
  it("summarizes the available signals", () => {
    const overlay = deterministicOverlay(SNAPSHOT, "2026-10-15");
    expect(overlay.today_outlook).toContain("2026-10-15");
    expect(overlay.today_outlook).toContain("autumn conditions.");
  });

  it("states unavailability when there are no signals", () => {
    const overlay = deterministicOverlay({ results: {}, missing: ["weather"] }, "2026-10-15");
    expect(overlay.today_outlook).toMatch(/unavailable/i);
  });
});
