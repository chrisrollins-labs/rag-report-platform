import type { QueryExecutor } from "@/db/executor";
import type { UsageRecord, UsageSink } from "./usage-log";

/**
 * The production UsageSink: one INSERT into ai_usage_log per model call
 * (ADR-008). A logging failure is swallowed and reported, never allowed to
 * fail the underlying model call — cost accounting is important, but not more
 * important than the request it is accounting for.
 */
export class PgUsageSink implements UsageSink {
  constructor(private readonly db: QueryExecutor) {}

  async record(r: UsageRecord): Promise<void> {
    try {
      await this.db.query(
        `insert into public.ai_usage_log
           (task, model, report_base_key, input_tokens, output_tokens,
            latency_ms, est_cost_usd, success, error)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          r.task,
          r.model,
          typeof r.meta?.key === "string" ? r.meta.key : null,
          r.inputTokens,
          r.outputTokens,
          r.latencyMs,
          r.estCostUsd,
          r.success,
          r.error ?? null,
        ],
      );
    } catch (e) {
      console.error("ai_usage_log insert failed:", e instanceof Error ? e.message : String(e));
    }
  }
}
