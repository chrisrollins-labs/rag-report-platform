import { describe, expect, it } from "vitest";
import { WeatherSignalProvider } from "@/signals/weather-provider";
import { scriptedFetch } from "../helpers/scripted-db";

const CTX = { region: "gulf", targetDate: "2026-10-15", lat: 29.3, lng: -94.8 };

function forecast(): Response {
  return new Response(
    JSON.stringify({
      daily: {
        time: ["2026-10-15"],
        temperature_2m_max: [27],
        temperature_2m_min: [19],
        wind_speed_10m_max: [22],
        precipitation_probability_max: [30],
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("WeatherSignalProvider", () => {
  it("returns null without coordinates (graceful, not fatal)", async () => {
    const provider = new WeatherSignalProvider({ fetchImpl: scriptedFetch([]) });
    expect(await provider.fetch({ region: "gulf", targetDate: "2026-10-15" })).toBeNull();
  });

  it("parses a forecast into a signal result", async () => {
    const provider = new WeatherSignalProvider({ fetchImpl: scriptedFetch([forecast()]) });
    const result = await provider.fetch(CTX);
    expect(result?.provider).toBe("weather");
    expect(result?.data.high).toBe(27);
    expect(result?.summary).toContain("High 27");
  });

  it("returns null on a non-2xx response", async () => {
    const provider = new WeatherSignalProvider({
      fetchImpl: scriptedFetch([new Response("nope", { status: 503 })]),
    });
    expect(await provider.fetch(CTX)).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    const provider = new WeatherSignalProvider({
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    });
    expect(await provider.fetch(CTX)).toBeNull();
  });
});
