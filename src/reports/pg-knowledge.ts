import type { QueryExecutor } from "@/db/executor";
import { logger } from "@/observability/logger";
import { embedTexts } from "@/rag/embeddings";
import { buildQueryText, normalizeTag, tagsForQuery } from "@/rag/tags";
import type { KnowledgeChunk, KnowledgeSource } from "./knowledge";
import type { ReportRequest } from "./key";

/**
 * The production KnowledgeSource (ADR-002, ADR-009): embed the request, match
 * the pgvector corpus through the rag.match_chunks function, return the top
 * chunks. When a real request finds an empty corpus for its subject/region, it
 * records a coverage-gap event — the demand signal that tells corpus expansion
 * what to prioritize. Failures are the caller's concern: getKnowledgeBlock
 * wraps retrieval in graceful-empty, so any throw here degrades to no context,
 * never a failed report.
 */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

interface MatchRow {
  title: string;
  source: string;
  content: string;
  similarity: number;
}

export interface PgKnowledgeOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class PgKnowledgeSource implements KnowledgeSource {
  constructor(
    private readonly db: QueryExecutor,
    private readonly opts: PgKnowledgeOptions = {},
  ) {}

  async retrieve(req: ReportRequest, limit: number): Promise<KnowledgeChunk[]> {
    const month = MONTHS[req.period.trim().toLowerCase()];
    const queryText = buildQueryText({ ...req, ...(month ? { month } : {}) });

    const { embeddings } = await embedTexts([queryText], {
      ...(this.opts.fetchImpl ? { fetchImpl: this.opts.fetchImpl } : {}),
      ...(this.opts.sleep ? { sleep: this.opts.sleep } : {}),
    });
    const embedding = embeddings[0];
    if (!embedding) return [];

    const tags = tagsForQuery({ ...req, ...(month ? { month } : {}) });
    const { rows } = await this.db.query<MatchRow>(
      `select title, source, content, similarity
       from rag.match_chunks($1::vector, $2, $3, $4)`,
      [`[${embedding.join(",")}]`, limit, normalizeTag(req.subject), tags.length ? tags : null],
    );

    if (rows.length === 0) {
      await this.recordCoverageGap(req);
      return [];
    }
    return rows.map((r) => ({ title: r.title, source: r.source, content: r.content }));
  }

  private async recordCoverageGap(req: ReportRequest): Promise<void> {
    try {
      await this.db.query(
        `insert into public.events (name, properties) values ('knowledge_coverage_gap', $1)`,
        [{ subject: req.subject, region: req.region, period: req.period }],
      );
    } catch (e) {
      logger.warn("coverage-gap event insert failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
