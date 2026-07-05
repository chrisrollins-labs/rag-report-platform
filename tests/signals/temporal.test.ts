import { describe, expect, it } from "vitest";
import { TemporalSignalProvider } from "@/signals/temporal-provider";

describe("TemporalSignalProvider", () => {
  const provider = new TemporalSignalProvider();

  it("is deterministic: same date in yields the same signal out", async () => {
    const a = await provider.fetch({ region: "gulf", targetDate: "2026-07-01" });
    const b = await provider.fetch({ region: "gulf", targetDate: "2026-07-01" });
    expect(a).toEqual(b);
  });

  it("derives a northern-hemisphere season from the target date", async () => {
    const summer = await provider.fetch({ region: "gulf", targetDate: "2026-07-01" });
    const winter = await provider.fetch({ region: "gulf", targetDate: "2026-01-15" });
    expect(summer?.data.season).toBe("summer");
    expect(winter?.data.season).toBe("winter");
    expect(summer?.summary).toContain("summer");
  });

  it("returns null on an unparseable date rather than throwing", async () => {
    const result = await provider.fetch({ region: "gulf", targetDate: "not-a-date" });
    expect(result).toBeNull();
  });

  it("reports more daylight near the summer solstice than midwinter", async () => {
    const summer = await provider.fetch({ region: "gulf", targetDate: "2026-06-21" });
    const winter = await provider.fetch({ region: "gulf", targetDate: "2026-12-21" });
    expect(Number(summer?.data.daylightHours)).toBeGreaterThan(
      Number(winter?.data.daylightHours),
    );
  });
});
