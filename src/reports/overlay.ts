import { generateStructured, type AiContext } from "@/ai/client";
import { logger } from "@/observability/logger";
import type { SignalSnapshot } from "@/signals/snapshot";
import type { ConditionsCache } from "./conditions-cache";
import { ADVISORY_OVERLAY_CONFIG } from "./prompts";
import { OverlaySchema, type AdvisoryReport, type Overlay } from "./schema";

/**
 * Layer 2 — the live overlay (ADR-003, ADR-004). It runs only when the target
 * date is inside a short window, is cached per (base, date) with a short TTL,
 * and falls back to a deterministic summary of the raw signals if the overlay
 * model call fails. A report is never blocked by the overlay: outside the
 * window it is simply absent; inside it, a model outage degrades to the
 * deterministic version.
 */

const OVERLAY_WINDOW_DAYS = 7;
const OVERLAY_TTL_MINUTES = 30;

export interface OverlayResult {
  overlay: Overlay | null;
  /** true = served from cache; false = produced now; null = not applicable. */
  cacheHit: boolean | null;
}

export function overlayApplies(targetDate: string, now: Date): boolean {
  const target = Date.parse(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(target)) return false;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const diffDays = (target - today) / 86_400_000;
  return diffDays >= 0 && diffDays <= OVERLAY_WINDOW_DAYS;
}

/** Deterministic fallback built purely from the signal snapshot. */
export function deterministicOverlay(snapshot: SignalSnapshot, targetDate: string): Overlay {
  const summaries = Object.values(snapshot.results).map((r) => r.summary);
  return {
    today_outlook:
      summaries.length > 0
        ? `Conditions for ${targetDate}: ${summaries.join(" ")}`
        : "Live conditions are unavailable for this date.",
    highlights: [],
    adjustments: [],
  };
}

export interface OverlayDeps {
  ai: AiContext;
  cache: ConditionsCache;
  now?: () => Date;
}

export async function getOverlay(
  deps: OverlayDeps,
  args: {
    base: AdvisoryReport;
    baseKey: string;
    region: string;
    targetDate: string;
    snapshot: SignalSnapshot;
  },
): Promise<OverlayResult> {
  const now = deps.now ?? (() => new Date());
  if (!overlayApplies(args.targetDate, now())) return { overlay: null, cacheHit: null };

  const dataType = `overlay:${args.targetDate}`;
  const cached = await deps.cache.get<Overlay>(args.baseKey, dataType);
  if (cached) return { overlay: cached, cacheHit: true };

  let overlay: Overlay;
  try {
    overlay = await generateStructured(
      deps.ai,
      {
        config: ADVISORY_OVERLAY_CONFIG,
        variables: {
          base_summary: `${args.base.summary}\n${args.base.outlook}`.slice(0, 1500),
          target_date: args.targetDate,
          region: args.region,
          signals_json: JSON.stringify(args.snapshot.results),
        },
        meta: { key: args.baseKey },
      },
      OverlaySchema,
    );
  } catch (e) {
    logger.warn("overlay generation failed; using deterministic fallback", {
      error: e instanceof Error ? e.message : String(e),
    });
    overlay = deterministicOverlay(args.snapshot, args.targetDate);
  }

  await deps.cache.set(args.baseKey, dataType, overlay, OVERLAY_TTL_MINUTES);
  return { overlay, cacheHit: false };
}
