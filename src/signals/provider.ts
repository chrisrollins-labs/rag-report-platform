/**
 * The signal-provider seam (ADR upgrade over the source's hardcoded vendor
 * calls). Live external data (weather, tides, astronomical time, public data)
 * enters the report through this one interface. Each provider is independent
 * and OPTIONAL: it returns a value or null, and a null never fails the report.
 * Adding a new data source is implementing this interface and registering it,
 * not touching the pipeline.
 */

export interface SignalContext {
  region: string;
  /** ISO date the report targets. */
  targetDate: string;
  /** IANA timezone, when known. */
  timezone?: string;
  /** Coordinates, when the request carries them. Providers that need a point
   *  (weather, tides) return null without them; providers that don't (temporal)
   *  ignore them. */
  lat?: number;
  lng?: number;
}

export interface SignalResult {
  /** Stable provider name; becomes the key in the assembled snapshot. */
  provider: string;
  /** Human-readable one-liner for the report's conditions note. */
  summary: string;
  /** Structured payload for downstream use. */
  data: Record<string, unknown>;
}

export interface SignalProvider {
  readonly name: string;
  fetch(ctx: SignalContext): Promise<SignalResult | null>;
}
