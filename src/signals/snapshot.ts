import { logger } from "@/observability/logger";
import type { SignalContext, SignalProvider, SignalResult } from "./provider";

/**
 * Assemble a signal snapshot from a set of providers. Every provider runs
 * concurrently and independently; one that throws or returns null is simply
 * absent from the result, never a request-killer (ADR-004). The snapshot is
 * the report's conditions input and never blocks generation.
 */

export interface SignalSnapshot {
  results: Record<string, SignalResult>;
  /** Providers that returned null or threw — surfaced for observability. */
  missing: string[];
}

export async function gatherSignals(
  providers: SignalProvider[],
  ctx: SignalContext,
): Promise<SignalSnapshot> {
  const settled = await Promise.all(
    providers.map(async (p): Promise<SignalResult | null> => {
      try {
        return await p.fetch(ctx);
      } catch (e) {
        logger.warn("signal provider failed (non-fatal)", {
          provider: p.name,
          error: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    }),
  );

  const results: Record<string, SignalResult> = {};
  const missing: string[] = [];
  providers.forEach((p, i) => {
    const r = settled[i];
    if (r) results[r.provider] = r;
    else missing.push(p.name);
  });

  return { results, missing };
}
