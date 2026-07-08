import { NextResponse } from "next/server";
import { z } from "zod";
import { ConfigError } from "@/shared/errors";
import { runReportPipeline } from "@/reports/pipeline";
import { buildPipelineDeps } from "@/reports/runtime";

/**
 * POST /api/reports — generate (or serve cached) an advisory report.
 *
 * The handler is a thin adapter: validate input with Zod, call the pipeline,
 * shape the response. All the engineering lives in the library, so this route
 * stays boring on purpose. A ConfigError (AI not wired up) is a clean 503,
 * not a 500 — it means "not configured", which is an operational state, not a
 * bug.
 */

export const runtime = "nodejs";

const RequestSchema = z.object({
  subject: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  period: z.string().min(1).max(60),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "targetDate must be YYYY-MM-DD"),
  parameters: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { targetDate, ...req } = parsed.data;
  try {
    const result = await runReportPipeline(buildPipelineDeps(), req, targetDate);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json(
        { error: "AI provider is not configured on this deployment" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report generation failed" },
      { status: 500 },
    );
  }
}
