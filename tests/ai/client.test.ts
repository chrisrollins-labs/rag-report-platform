import { describe, expect, it } from "vitest";
import { callModel, generateStructured, type AiContext, type PromptConfig } from "@/ai/client";
import { MockTransport, failingTransport } from "@/ai/providers/mock";
import { InMemoryUsageSink } from "@/ai/usage-log";
import { ValidationError } from "@/shared/errors";
import { AdvisoryReportSchema } from "@/reports/schema";
import {
  FENCED_ADVISORY,
  INVALID_ADVISORY_JSON,
  VALID_ADVISORY,
  VALID_ADVISORY_JSON,
} from "../helpers/fixtures";

const CONFIG: PromptConfig = {
  task: "advisory_base",
  model: "example/model-name",
  systemTemplate: "System for {{subject}}.",
  userTemplate: "Write about {{subject}} in {{region}}.",
  params: { temperature: 0.4 },
};

function ctxWith(transport: MockTransport | ReturnType<typeof failingTransport>): {
  ctx: AiContext;
  sink: InMemoryUsageSink;
} {
  const sink = new InMemoryUsageSink();
  const generate = transport instanceof MockTransport ? transport.generate : transport;
  return { ctx: { generate, sink }, sink };
}

describe("callModel", () => {
  it("renders templates, returns text, and logs a success usage record", async () => {
    const transport = new MockTransport(["hello"], { inputTokens: 120, outputTokens: 30 });
    const { ctx, sink } = ctxWith(transport);

    const result = await callModel(ctx, {
      config: CONFIG,
      variables: { subject: "tides", region: "gulf" },
    });

    expect(result.text).toBe("hello");
    expect(transport.calls[0]?.system).toBe("System for tides.");
    expect(transport.calls[0]?.prompt).toBe("Write about tides in gulf.");
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ success: true, inputTokens: 120, outputTokens: 30 });
    expect(sink.records[0]?.estCostUsd).toBeGreaterThan(0);
  });

  it("logs a failure usage record and rethrows on transport error", async () => {
    const { ctx, sink } = ctxWith(failingTransport("boom"));

    await expect(
      callModel(ctx, { config: CONFIG, variables: { subject: "x", region: "y" } }),
    ).rejects.toThrow("boom");

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ success: false, error: "boom", estCostUsd: 0 });
  });
});

describe("generateStructured", () => {
  it("parses valid JSON output against the schema", async () => {
    const transport = new MockTransport([VALID_ADVISORY_JSON]);
    const { ctx } = ctxWith(transport);

    const out = await generateStructured(
      ctx,
      { config: CONFIG, variables: { subject: "s", region: "r" } },
      AdvisoryReportSchema,
    );

    expect(out).toEqual(VALID_ADVISORY);
    expect(transport.calls).toHaveLength(1);
  });

  it("extracts JSON from a markdown fence", async () => {
    const transport = new MockTransport([FENCED_ADVISORY]);
    const { ctx } = ctxWith(transport);

    const out = await generateStructured(
      ctx,
      { config: CONFIG, variables: { subject: "s", region: "r" } },
      AdvisoryReportSchema,
    );

    expect(out.summary).toBe(VALID_ADVISORY.summary);
  });

  it("retries once with a corrective suffix on invalid output, then succeeds", async () => {
    const transport = new MockTransport([INVALID_ADVISORY_JSON, VALID_ADVISORY_JSON]);
    const { ctx, sink } = ctxWith(transport);

    const out = await generateStructured(
      ctx,
      { config: CONFIG, variables: { subject: "s", region: "r" } },
      AdvisoryReportSchema,
    );

    expect(out).toEqual(VALID_ADVISORY);
    expect(transport.calls).toHaveLength(2);
    // The retry prompt carries the corrective instruction; the first does not.
    expect(transport.calls[0]?.prompt).not.toContain("not valid JSON");
    expect(transport.calls[1]?.prompt).toContain("not valid JSON");
    // Both attempts are cost-logged.
    expect(sink.records).toHaveLength(2);
  });

  it("throws ValidationError after the retry also fails", async () => {
    const transport = new MockTransport([INVALID_ADVISORY_JSON, INVALID_ADVISORY_JSON]);
    const { ctx } = ctxWith(transport);

    await expect(
      generateStructured(
        ctx,
        { config: CONFIG, variables: { subject: "s", region: "r" } },
        AdvisoryReportSchema,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(transport.calls).toHaveLength(2);
  });
});
