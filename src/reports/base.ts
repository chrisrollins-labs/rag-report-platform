import type { AdvisoryReport } from "./schema";
import type { ReportBaseRow, ReportStore } from "./store";

/**
 * Layer 1 — the durable report base cache (ADR-003). Lookup by key; on a miss,
 * exactly one caller generates while any concurrent callers poll for the
 * result. A crashed generation (stale 'generating' row) or a prior failure is
 * reclaimed and retried. This is the piece that makes the warm path cheap: an
 * expensive model generation happens once per key and is reused thereafter.
 */

export interface EnsureBaseDeps {
  store: ReportStore;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  staleMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export interface EnsureBaseResult {
  base: ReportBaseRow;
  cacheHit: boolean;
}

/** Produces the base content on a miss. Throws to signal generation failure. */
export type GenerateContent = () => Promise<{ content: AdvisoryReport; model: string }>;

const DEFAULT_STALE_MS = 5 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

export async function ensureReportBase(
  deps: EnsureBaseDeps,
  key: string,
  generate: GenerateContent,
): Promise<EnsureBaseResult> {
  const { store } = deps;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const staleMs = deps.staleMs ?? DEFAULT_STALE_MS;
  const pollInterval = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const pollTimeout = deps.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;

  const existing = await store.get(key);
  if (existing?.status === "ready") return { base: existing, cacheHit: true };

  // Reclaim a failed row, or a generating row whose owner appears to have died.
  if (
    existing &&
    (existing.status === "failed" ||
      (existing.status === "generating" && now() - existing.updatedAt > staleMs))
  ) {
    await store.takeover(key);
    const base = await runGeneration(store, key, generate);
    return { base, cacheHit: false };
  }

  if (!existing) {
    // Guarded insert: exactly one concurrent caller wins ownership of the key.
    const { inserted } = await store.insertGenerating(key);
    if (inserted) {
      const base = await runGeneration(store, key, generate);
      return { base, cacheHit: false };
    }
  }

  // Someone else owns generation — poll until ready, failed, or timeout.
  const deadline = now() + pollTimeout;
  while (now() < deadline) {
    await sleep(pollInterval);
    const current = await store.get(key);
    if (current?.status === "ready") return { base: current, cacheHit: true };
    if (current?.status === "failed") {
      throw new Error(`Base generation failed: ${current.error ?? "unknown error"}`);
    }
  }
  throw new Error("Timed out waiting for concurrent base generation");
}

async function runGeneration(
  store: ReportStore,
  key: string,
  generate: GenerateContent,
): Promise<ReportBaseRow> {
  try {
    const { content, model } = await generate();
    return await store.markReady(key, content, model);
  } catch (e) {
    await store.markFailed(key, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
