import { describe, expect, it } from "vitest";
import { ensureReportBase } from "@/reports/base";
import { InMemoryReportStore } from "@/reports/store";
import { VALID_ADVISORY } from "../helpers/fixtures";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("ensureReportBase", () => {
  it("generates once on a miss and serves the cache thereafter", async () => {
    const store = new InMemoryReportStore();
    let generations = 0;
    const generate = async () => {
      generations++;
      return { content: VALID_ADVISORY, model: "example/model-name" };
    };

    const first = await ensureReportBase({ store }, "k1", generate);
    const second = await ensureReportBase({ store }, "k1", generate);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.base.content).toEqual(VALID_ADVISORY);
    expect(generations).toBe(1);
  });

  it("guards against double generation under concurrency", async () => {
    const store = new InMemoryReportStore();
    let generations = 0;
    const generate = async () => {
      generations++;
      await delay(15); // hold the lock so the second caller must poll
      return { content: VALID_ADVISORY, model: "example/model-name" };
    };

    const [a, b] = await Promise.all([
      ensureReportBase({ store, pollIntervalMs: 1 }, "k2", generate),
      ensureReportBase({ store, pollIntervalMs: 1 }, "k2", generate),
    ]);

    // Exactly one generation ran; both callers got the ready base.
    expect(generations).toBe(1);
    expect(a.base.status).toBe("ready");
    expect(b.base.status).toBe("ready");
    // One owned generation (miss), the other polled to a hit.
    expect([a.cacheHit, b.cacheHit].sort()).toEqual([false, true]);
  });

  it("reclaims a failed row and regenerates", async () => {
    const store = new InMemoryReportStore();
    await store.insertGenerating("k3");
    await store.markFailed("k3", "earlier crash");

    const result = await ensureReportBase({ store }, "k3", async () => ({
      content: VALID_ADVISORY,
      model: "example/model-name",
    }));

    expect(result.cacheHit).toBe(false);
    expect(result.base.status).toBe("ready");
  });

  it("marks the row failed and rethrows when generation throws", async () => {
    const store = new InMemoryReportStore();

    await expect(
      ensureReportBase({ store }, "k4", async () => {
        throw new Error("generation exploded");
      }),
    ).rejects.toThrow("generation exploded");

    const row = await store.get("k4");
    expect(row?.status).toBe("failed");
    expect(row?.error).toBe("generation exploded");
  });
});
