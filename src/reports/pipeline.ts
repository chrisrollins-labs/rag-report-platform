import { generateStructured, type AiContext } from "@/ai/client";
import { logger } from "@/observability/logger";
import { gatherSignals, type SignalSnapshot } from "@/signals/snapshot";
import type { SignalContext, SignalProvider } from "@/signals/provider";
import type { ConditionsCache } from "./conditions-cache";
import { ensureReportBase } from "./base";
import { getKnowledgeBlock, type KnowledgeSource } from "./knowledge";
import { buildReportKey, type ReportRequest } from "./key";
import { getOverlay } from "./overlay";
import { ADVISORY_BASE_CONFIG } from "./prompts";
import { AdvisoryReportSchema, type AdvisoryReport, type Overlay } from "./schema";
import type { ReportStore } from "./store";

/**
 * The report orchestrator (ADR-003, ADR-004). One entry point:
 *
 *   1. Resolve the durable base from the L1 cache, generating it once on a
 *      miss (RAG-grounded, structured, cost-logged).
 *   2. Gather live signals concurrently — each optional, none able to fail
 *      the report.
 *   3. Apply the live overlay when the date is near and a cache is wired,
 *      degrading to a deterministic overlay on model failure.
 *   4. Assemble the result with honest provenance.
 *
 * A base-generation failure is the only hard failure; every signal and the
 * overlay degrade independently.
 */

export interface PipelineDeps {
  ai: AiContext;
  store: ReportStore;
  providers: SignalProvider[];
  knowledge?: KnowledgeSource;
  /** When provided (with a near-term date), the live overlay runs. */
  conditionsCache?: ConditionsCache;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ReportResult {
  key: string;
  request: ReportRequest;
  advisory: AdvisoryReport;
  overlay: Overlay | null;
  signals: SignalSnapshot;
  provenance: {
    cacheHit: boolean;
    overlayCacheHit: boolean | null;
    model: string | null;
    missingSignals: string[];
    generatedAt: string;
  };
}

function buildSignalContext(req: ReportRequest, targetDate: string): SignalContext {
  const params = req.parameters ?? {};
  const lat = params.lat !== undefined ? Number(params.lat) : undefined;
  const lng = params.lng !== undefined ? Number(params.lng) : undefined;
  return {
    region: req.region,
    targetDate,
    ...(params.timezone ? { timezone: params.timezone } : {}),
    ...(lat !== undefined && !Number.isNaN(lat) ? { lat } : {}),
    ...(lng !== undefined && !Number.isNaN(lng) ? { lng } : {}),
  };
}

export async function runReportPipeline(
  deps: PipelineDeps,
  req: ReportRequest,
  targetDate: string,
): Promise<ReportResult> {
  const key = buildReportKey(req);

  const { base, cacheHit } = await ensureReportBase(
    { store: deps.store, now: deps.now, sleep: deps.sleep },
    key,
    async () => {
      const knowledge = await getKnowledgeBlock(deps.knowledge, req);
      const content = await generateStructured(
        deps.ai,
        {
          config: ADVISORY_BASE_CONFIG,
          variables: { subject: req.subject, region: req.region, period: req.period, knowledge },
          meta: { key },
        },
        AdvisoryReportSchema,
      );
      return { content, model: ADVISORY_BASE_CONFIG.model };
    },
  );

  if (!base.content) throw new Error("Report base resolved without content");

  const signals = await gatherSignals(deps.providers, buildSignalContext(req, targetDate));
  if (signals.missing.length > 0) {
    logger.info("report completed with degraded signals", { key, missing: signals.missing });
  }

  let overlay: Overlay | null = null;
  let overlayCacheHit: boolean | null = null;
  if (deps.conditionsCache) {
    const result = await getOverlay(
      {
        ai: deps.ai,
        cache: deps.conditionsCache,
        ...(deps.now ? { now: () => new Date(deps.now!()) } : {}),
      },
      { base: base.content, baseKey: key, region: req.region, targetDate, snapshot: signals },
    );
    overlay = result.overlay;
    overlayCacheHit = result.cacheHit;
  }

  return {
    key,
    request: req,
    advisory: base.content,
    overlay,
    signals,
    provenance: {
      cacheHit,
      overlayCacheHit,
      model: base.model,
      missingSignals: signals.missing,
      generatedAt: new Date().toISOString(),
    },
  };
}
