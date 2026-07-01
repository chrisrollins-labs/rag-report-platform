import type { AdvisoryReport } from "./schema";

/**
 * The report-base store (ADR-003). The interface is what the cache state
 * machine depends on; the in-memory implementation is what makes the whole
 * path runnable and testable with no database. Production swaps in a
 * Postgres-backed implementation where `insertGenerating` is a guarded insert
 * (ON CONFLICT DO NOTHING) so exactly one concurrent request wins ownership.
 * The in-memory version reproduces that guard with a plain Map check.
 */

export type BaseStatus = "generating" | "ready" | "failed";

export interface ReportBaseRow {
  key: string;
  status: BaseStatus;
  content: AdvisoryReport | null;
  model: string | null;
  updatedAt: number;
  error: string | null;
}

export interface ReportStore {
  get(key: string): Promise<ReportBaseRow | null>;
  /** Guarded insert: true if THIS caller created the generating row. */
  insertGenerating(key: string): Promise<{ inserted: boolean }>;
  /** Reclaim a failed or stale-generating row for regeneration. */
  takeover(key: string): Promise<void>;
  markReady(key: string, content: AdvisoryReport, model: string): Promise<ReportBaseRow>;
  markFailed(key: string, error: string): Promise<void>;
}

export class InMemoryReportStore implements ReportStore {
  private readonly rows = new Map<string, ReportBaseRow>();
  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
  }

  async get(key: string): Promise<ReportBaseRow | null> {
    return this.rows.get(key) ?? null;
  }

  async insertGenerating(key: string): Promise<{ inserted: boolean }> {
    if (this.rows.has(key)) return { inserted: false };
    this.rows.set(key, {
      key,
      status: "generating",
      content: null,
      model: null,
      updatedAt: this.clock(),
      error: null,
    });
    return { inserted: true };
  }

  async takeover(key: string): Promise<void> {
    const row = this.rows.get(key);
    if (row) {
      row.status = "generating";
      row.error = null;
      row.updatedAt = this.clock();
    }
  }

  async markReady(key: string, content: AdvisoryReport, model: string): Promise<ReportBaseRow> {
    const row: ReportBaseRow = {
      key,
      status: "ready",
      content,
      model,
      updatedAt: this.clock(),
      error: null,
    };
    this.rows.set(key, row);
    return row;
  }

  async markFailed(key: string, error: string): Promise<void> {
    const row = this.rows.get(key);
    if (row) {
      row.status = "failed";
      row.error = error;
      row.updatedAt = this.clock();
    }
  }
}
