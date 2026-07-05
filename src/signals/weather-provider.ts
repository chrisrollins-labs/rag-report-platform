import { logger } from "@/observability/logger";
import type { SignalContext, SignalProvider, SignalResult } from "./provider";

/**
 * A live weather signal provider over an open forecast API (the default
 * endpoint follows the Open-Meteo request shape, which needs no API key). It
 * demonstrates a real network-backed provider that stays honest about the
 * degradation contract (ADR-004): no coordinates, a non-2xx response, or a
 * fetch failure all return null, so the report ships without this signal and
 * never blocks on it. fetch is injected, so the provider is tested offline.
 */

export interface WeatherProviderOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

interface ForecastResponse {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    wind_speed_10m_max?: number[];
    precipitation_probability_max?: number[];
  };
}

const DEFAULT_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export class WeatherSignalProvider implements SignalProvider {
  readonly name = "weather";
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(opts: WeatherProviderOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async fetch(ctx: SignalContext): Promise<SignalResult | null> {
    if (ctx.lat === undefined || ctx.lng === undefined) return null;

    const url = new URL(this.endpoint);
    url.searchParams.set("latitude", String(ctx.lat));
    url.searchParams.set("longitude", String(ctx.lng));
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_probability_max",
    );
    url.searchParams.set("start_date", ctx.targetDate);
    url.searchParams.set("end_date", ctx.targetDate);
    if (ctx.timezone) url.searchParams.set("timezone", ctx.timezone);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        logger.warn("weather provider non-2xx (non-fatal)", { status: res.status });
        return null;
      }
      const json = (await res.json()) as ForecastResponse;
      const d = json.daily;
      if (!d?.time?.length) return null;

      const high = d.temperature_2m_max?.[0];
      const low = d.temperature_2m_min?.[0];
      const wind = d.wind_speed_10m_max?.[0];
      const precip = d.precipitation_probability_max?.[0];

      return {
        provider: this.name,
        summary:
          `High ${round(high)}° / low ${round(low)}°, wind to ${round(wind)}, ` +
          `precip chance ${round(precip)}%.`,
        data: { high, low, windMax: wind, precipProbability: precip, date: d.time[0] },
      };
    } catch (e) {
      logger.warn("weather provider fetch failed (non-fatal)", {
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function round(n: number | undefined): string {
  return n === undefined ? "n/a" : String(Math.round(n));
}
