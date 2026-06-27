/**
 * Cost instrumentation (ADR-008). Every model call — success OR failure —
 * produces one usage record. In production the sink writes a row to an
 * ai_usage_log table; here the sink is an interface so tests assert on what
 * was recorded and the console sink gives a live trail with zero setup.
 *
 * Centralizing this is the whole point: because all model calls go through
 * one client (ADR-001), there is exactly one place that emits cost, so
 * "cost per report" is a query, not an archaeology project.
 */

export interface UsageRecord {
  task: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estCostUsd: number;
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface UsageSink {
  record(record: UsageRecord): Promise<void> | void;
}

/** Default sink: structured line per call. Swap for a DB-backed sink in prod. */
export class ConsoleUsageSink implements UsageSink {
  record(r: UsageRecord): void {
    console.log(JSON.stringify({ level: "info", msg: "ai_usage", ...r }));
  }
}

/** Test/eval sink: keeps records in memory for assertions and aggregation. */
export class InMemoryUsageSink implements UsageSink {
  readonly records: UsageRecord[] = [];

  record(r: UsageRecord): void {
    this.records.push(r);
  }

  get totalCostUsd(): number {
    return this.records.reduce((sum, r) => sum + r.estCostUsd, 0);
  }
}
