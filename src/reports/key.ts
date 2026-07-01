/**
 * A report base is a pure function of the inputs that actually determine its
 * durable content: subject, region, period, and normalized parameters. The
 * cache key is derived from exactly those, so two requests that should share a
 * base do, and two that should not, do not. Live, fast-changing inputs (the
 * exact date, current signals) are deliberately NOT in the key — they belong
 * to the live overlay layer, not the durable base (ADR-003).
 */

export interface ReportRequest {
  subject: string;
  region: string;
  /** Coarse period bucket, e.g. a month name or season. Not an exact date. */
  period: string;
  /** Optional free-form parameters that change the durable advice. */
  parameters?: Record<string, string>;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function buildReportKey(req: ReportRequest): string {
  const params = req.parameters ?? {};
  const paramPart = Object.keys(params)
    .sort()
    .map((k) => `${normalize(k)}=${normalize(params[k] ?? "")}`)
    .join("&");
  return [normalize(req.subject), normalize(req.region), normalize(req.period), paramPart]
    .filter(Boolean)
    .join("::");
}
