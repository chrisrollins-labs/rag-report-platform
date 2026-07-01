import type { QueryExecutor } from "@/db/executor";
import type { AdvisoryReport } from "./schema";
import type { BaseStatus, ReportBaseRow, ReportStore } from "./store";

/**
 * The production ReportStore, backed by Postgres (ADR-003). The concurrency
 * guarantee comes from the database: `insertGenerating` is an
 * INSERT ... ON CONFLICT (cache_key) DO NOTHING, so exactly one concurrent
 * request creates the row and becomes the generation owner. It implements the
 * same interface as the in-memory store, so the pipeline and every test are
 * unchanged when this is wired in.
 */

interface BaseDbRow {
  cache_key: string;
  status: BaseStatus;
  content: AdvisoryReport | null;
  model: string | null;
  updated_at: string;
  error: string | null;
}

function mapRow(row: BaseDbRow): ReportBaseRow {
  return {
    key: row.cache_key,
    status: row.status,
    content: row.content,
    model: row.model,
    updatedAt: new Date(row.updated_at).getTime(),
    error: row.error,
  };
}

const SELECT_COLUMNS = "cache_key, status, content, model, updated_at, error";

export class PgReportStore implements ReportStore {
  constructor(private readonly db: QueryExecutor) {}

  async get(key: string): Promise<ReportBaseRow | null> {
    const { rows } = await this.db.query<BaseDbRow>(
      `select ${SELECT_COLUMNS} from public.report_bases where cache_key = $1`,
      [key],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async insertGenerating(key: string): Promise<{ inserted: boolean }> {
    const { rows } = await this.db.query<{ cache_key: string }>(
      `insert into public.report_bases (cache_key, status)
       values ($1, 'generating')
       on conflict (cache_key) do nothing
       returning cache_key`,
      [key],
    );
    return { inserted: rows.length > 0 };
  }

  async takeover(key: string): Promise<void> {
    await this.db.query(
      `update public.report_bases
       set status = 'generating', error = null, updated_at = now()
       where cache_key = $1`,
      [key],
    );
  }

  async markReady(key: string, content: AdvisoryReport, model: string): Promise<ReportBaseRow> {
    const { rows } = await this.db.query<BaseDbRow>(
      `update public.report_bases
       set status = 'ready', content = $2, model = $3, error = null, updated_at = now()
       where cache_key = $1
       returning ${SELECT_COLUMNS}`,
      [key, content, model],
    );
    if (!rows[0]) throw new Error(`report_bases row vanished for key ${key}`);
    return mapRow(rows[0]);
  }

  async markFailed(key: string, error: string): Promise<void> {
    await this.db.query(
      `update public.report_bases
       set status = 'failed', error = $2, updated_at = now()
       where cache_key = $1`,
      [key, error],
    );
  }
}
