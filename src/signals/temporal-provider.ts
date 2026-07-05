import type { SignalContext, SignalProvider, SignalResult } from "./provider";

/**
 * A fully deterministic signal provider: season and daylight bucket derived
 * from the target date with pure computation, no network. It exists to prove
 * the point of ADR-004 — at least one signal always resolves, so the report
 * never has an empty conditions section even with every network source down.
 * It is also the easiest provider to test, because its output is a function of
 * its input and nothing else.
 */

function seasonForMonth(month: number, southern: boolean): string {
  // month: 1–12. Northern hemisphere default.
  const northern = ["winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const season = northern[(month - 1) % 12] ?? "unknown";
  if (!southern) return season;
  const flip: Record<string, string> = {
    winter: "summer", summer: "winter", spring: "autumn", autumn: "spring",
  };
  return flip[season] ?? season;
}

export class TemporalSignalProvider implements SignalProvider {
  readonly name = "temporal";

  async fetch(ctx: SignalContext): Promise<SignalResult | null> {
    const date = new Date(`${ctx.targetDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;

    const month = date.getUTCMonth() + 1;
    const dayOfYear = Math.floor(
      (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000,
    );
    const season = seasonForMonth(month, /* southern */ false);
    // Rough daylight fraction via a cosine over the year — illustrative, not
    // an ephemeris. Peaks near the summer solstice (~day 172).
    const daylightFraction = 0.5 + 0.2 * Math.cos((2 * Math.PI * (dayOfYear - 172)) / 365);

    return {
      provider: this.name,
      summary: `${season} conditions; roughly ${(daylightFraction * 24).toFixed(1)} h of daylight.`,
      data: { season, dayOfYear, daylightHours: Number((daylightFraction * 24).toFixed(1)) },
    };
  }
}
