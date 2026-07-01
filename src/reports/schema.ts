import { z } from "zod";

/**
 * The structured contract for a generated advisory (ADR-005). The model is
 * held to this shape; anything that does not parse triggers the corrective
 * retry and then a loud failure. Keeping the schema narrow and required makes
 * the model's job unambiguous and the downstream rendering total (no optional
 * chaining spelunking in the UI).
 */

export const AdvisoryReportSchema = z.object({
  summary: z.string().min(1),
  outlook: z.string().min(1),
  key_factors: z
    .array(
      z.object({
        factor: z.string().min(1),
        detail: z.string().min(1),
      }),
    )
    .min(1),
  recommendations: z.array(z.string().min(1)).min(1),
});

export type AdvisoryReport = z.infer<typeof AdvisoryReportSchema>;

/**
 * The live overlay (ADR-003 L2): a short, time-sensitive adjustment layered on
 * the durable base when the target date is near. Kept separate from the base
 * schema because it has a different cache lifetime and a deterministic fallback
 * (ADR-004).
 */
export const OverlaySchema = z.object({
  today_outlook: z.string().min(1),
  highlights: z.array(z.object({ window: z.string().min(1), note: z.string().min(1) })),
  adjustments: z.array(z.string().min(1)),
});

export type Overlay = z.infer<typeof OverlaySchema>;
