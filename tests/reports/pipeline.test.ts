import { describe, expect, it } from "vitest";
import { MockTransport } from "@/ai/providers/mock";
import { InMemoryUsageSink } from "@/ai/usage-log";
import { runReportPipeline, type PipelineDeps } from "@/reports/pipeline";
import { InMemoryReportStore } from "@/reports/store";
import { SampleKnowledgeSource } from "@/reports/knowledge";
import { TemporalSignalProvider } from "@/signals/temporal-provider";
import type { SignalProvider } from "@/signals/provider";
import { VALID_ADVISORY, VALID_ADVISORY_JSON } from "../helpers/fixtures";

const REQ = { subject: "coastal site conditions", region: "central gulf coast", period: "october" };
const DATE = "2026-10-15";

function deps(transport: MockTransport, providers: SignalProvider[]): PipelineDeps {
  return {
    ai: { generate: transport.generate, sink: new InMemoryUsageSink() },
    store: new InMemoryReportStore(),
    providers,
    knowledge: new SampleKnowledgeSource(),
  };
}

describe("runReportPipeline", () => {
  it("generates a grounded, structured report end to end", async () => {
    const transport = new MockTransport([VALID_ADVISORY_JSON]);
    const result = await runReportPipeline(deps(transport, [new TemporalSignalProvider()]), REQ, DATE);

    expect(result.advisory).toEqual(VALID_ADVISORY);
    expect(result.provenance.cacheHit).toBe(false);
    expect(result.signals.results.temporal).toBeDefined();
    expect(result.signals.results.temporal?.data.season).toBe("autumn");
    expect(result.provenance.missingSignals).toEqual([]);

    // The prompt was actually grounded with retrieved knowledge.
    expect(transport.calls[0]?.prompt).toContain("Curated knowledge");
    expect(transport.calls[0]?.prompt).toContain("Coastal site profile");
  });

  it("serves the cache on the second identical request (one model call total)", async () => {
    const transport = new MockTransport([VALID_ADVISORY_JSON]);
    const d = deps(transport, [new TemporalSignalProvider()]);

    const first = await runReportPipeline(d, REQ, DATE);
    const second = await runReportPipeline(d, REQ, DATE);

    expect(first.provenance.cacheHit).toBe(false);
    expect(second.provenance.cacheHit).toBe(true);
    expect(transport.calls).toHaveLength(1); // the base was reused, not regenerated
  });

  it("degrades a failing signal without failing the report", async () => {
    const transport = new MockTransport([VALID_ADVISORY_JSON]);
    const flaky: SignalProvider = {
      name: "flaky",
      fetch: async () => {
        throw new Error("upstream 500");
      },
    };

    const result = await runReportPipeline(
      deps(transport, [new TemporalSignalProvider(), flaky]),
      REQ,
      DATE,
    );

    expect(result.advisory).toEqual(VALID_ADVISORY);
    expect(result.provenance.missingSignals).toContain("flaky");
    expect(result.signals.results.temporal).toBeDefined();
  });
});
