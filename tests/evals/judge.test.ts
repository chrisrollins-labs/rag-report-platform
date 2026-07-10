import { describe, expect, it } from "vitest";
import { MockTransport } from "@/ai/providers/mock";
import { InMemoryUsageSink } from "@/ai/usage-log";
import { runJudge } from "../../evals/judge";
import { VALID_ADVISORY } from "../helpers/fixtures";

const REQUEST = { subject: "coastal site conditions", region: "gulf", period: "october" };

describe("runJudge", () => {
  it("computes overall as the mean of the four dimensions", async () => {
    const transport = new MockTransport([
      JSON.stringify({
        relevance: 4,
        actionability: 5,
        groundedness: 4,
        clarity: 5,
        reasoning: "Solid and grounded.",
      }),
    ]);
    const ai = { generate: transport.generate, sink: new InMemoryUsageSink() };

    const result = await runJudge(ai, { request: REQUEST, advisory: VALID_ADVISORY });

    expect(result.overall).toBe(4.5);
    expect(result.relevance).toBe(4);
    expect(result.reasoning).toContain("grounded");
    // The judge call went through the shared client, so it is cost-logged.
    expect((ai.sink as InMemoryUsageSink).records).toHaveLength(1);
  });

  it("retries once when the judge returns malformed output", async () => {
    const transport = new MockTransport([
      "not json",
      JSON.stringify({ relevance: 3, actionability: 3, groundedness: 3, clarity: 3, reasoning: "ok" }),
    ]);
    const ai = { generate: transport.generate, sink: new InMemoryUsageSink() };

    const result = await runJudge(ai, { request: REQUEST, advisory: VALID_ADVISORY });

    expect(result.overall).toBe(3);
    expect(transport.calls).toHaveLength(2);
  });
});
