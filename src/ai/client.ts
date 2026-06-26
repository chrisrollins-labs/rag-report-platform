import type { z } from "zod";
import { ValidationError, messageOf } from "@/shared/errors";
import { extractJson } from "./json";
import { estimateCostUsd } from "./pricing";
import { renderTemplate } from "./templates";
import type { GenerateFn } from "./transport";
import type { UsageSink } from "./usage-log";

/**
 * The one place model calls happen (ADR-001). Every call renders a versioned
 * template, goes through the injected transport, and logs a usage record on
 * both success and failure (ADR-008). generateStructured adds Zod validation
 * with a single corrective retry (ADR-005): the model gets exactly one chance
 * to fix malformed output before we fail loudly, which kills the "parse, then
 * regex-repair, then hope" fragility without masking a genuinely broken prompt.
 */

export interface PromptConfig {
  task: string;
  model: string;
  systemTemplate: string;
  userTemplate: string;
  params?: { temperature?: number; maxOutputTokens?: number };
}

export interface AiContext {
  generate: GenerateFn;
  sink: UsageSink;
  now?: () => number;
}

export interface CallModelArgs {
  config: PromptConfig;
  variables: Record<string, string>;
  /** Appended to the user prompt — used by the structured-output retry. */
  promptSuffix?: string;
  /** Free-form context threaded into the usage record (report id, etc.). */
  meta?: Record<string, unknown>;
}

export interface CallModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callModel(ctx: AiContext, args: CallModelArgs): Promise<CallModelResult> {
  const now = ctx.now ?? Date.now;
  const system = renderTemplate(args.config.systemTemplate, args.variables);
  const prompt =
    renderTemplate(args.config.userTemplate, args.variables) +
    (args.promptSuffix ? `\n\n${args.promptSuffix}` : "");

  const started = now();
  try {
    const result = await ctx.generate({
      model: args.config.model,
      system,
      prompt,
      ...(args.config.params?.temperature !== undefined
        ? { temperature: args.config.params.temperature }
        : {}),
      ...(args.config.params?.maxOutputTokens !== undefined
        ? { maxOutputTokens: args.config.params.maxOutputTokens }
        : {}),
    });
    await ctx.sink.record({
      task: args.config.task,
      model: args.config.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: now() - started,
      estCostUsd: estimateCostUsd(args.config.model, result.inputTokens, result.outputTokens),
      success: true,
      ...(args.meta ? { meta: args.meta } : {}),
    });
    return result;
  } catch (e) {
    await ctx.sink.record({
      task: args.config.task,
      model: args.config.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: now() - started,
      estCostUsd: 0,
      success: false,
      error: messageOf(e),
      ...(args.meta ? { meta: args.meta } : {}),
    });
    throw e;
  }
}

const RETRY_SUFFIX =
  "IMPORTANT: Your previous response was not valid JSON matching the required format. " +
  "Respond with ONLY the JSON object — no prose, no markdown fences.";

/**
 * callModel + extract + Zod parse, with one corrective retry on invalid
 * output. Two attempts total: the first as given, the second with a suffix
 * telling the model exactly what went wrong.
 */
export async function generateStructured<S extends z.ZodTypeAny>(
  ctx: AiContext,
  args: CallModelArgs,
  schema: S,
): Promise<z.infer<S>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const call = attempt === 0 ? args : { ...args, promptSuffix: RETRY_SUFFIX };
    const { text } = await callModel(ctx, call);
    try {
      // extractJson can throw on non-JSON output; treat that as a parse
      // failure so it triggers the corrective retry, not a hard throw.
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error;
    } catch (e) {
      lastError = e;
    }
  }
  throw new ValidationError(
    `Model output failed schema validation after one retry: ${messageOf(lastError)}`,
  );
}
