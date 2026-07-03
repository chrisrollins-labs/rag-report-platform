/**
 * Retrieval seam (ADR-009). Production embeds the request and matches a
 * pgvector corpus over an HNSW index with tag filters; this slice ships an
 * in-memory sample source so the path is exercised end to end without a
 * database. Both honor the same contract and the same rule: retrieval is
 * graceful-empty. No source, no match, or any failure returns "" and
 * generation proceeds unaided — retrieval is never a request-killer.
 */

import { logger } from "@/observability/logger";
import type { ReportRequest } from "./key";

export interface KnowledgeChunk {
  title: string;
  source: string;
  content: string;
}

export interface KnowledgeSource {
  retrieve(req: ReportRequest, limit: number): Promise<KnowledgeChunk[]>;
}

/** A tiny synthetic corpus so the reference path returns real-looking context. */
const SAMPLE_CORPUS: KnowledgeChunk[] = [
  {
    title: "Coastal site profile",
    source: "sample_profile",
    content:
      "Coastal sites in this region see the strongest onshore flow in late " +
      "afternoon; sheltered pockets on the lee side hold up best when the " +
      "prevailing wind is up.",
  },
  {
    title: "Seasonal pattern note",
    source: "sample_profile",
    content:
      "Through the shoulder season, conditions swing quickly day to day; plan " +
      "around the forecast window rather than a single day's outlook.",
  },
];

export class SampleKnowledgeSource implements KnowledgeSource {
  async retrieve(req: ReportRequest, limit: number): Promise<KnowledgeChunk[]> {
    // A real source would filter by embedded similarity + tags; the sample
    // returns a stable slice so the generated report is deterministic in demos.
    void req;
    return SAMPLE_CORPUS.slice(0, limit);
  }
}

export function formatKnowledge(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "No curated knowledge is available for this request yet.";
  return chunks.map((c, i) => `[${i + 1}] ${c.title} (${c.source})\n${c.content}`).join("\n\n");
}

/** Retrieve + format, graceful-empty on any failure. */
export async function getKnowledgeBlock(
  source: KnowledgeSource | undefined,
  req: ReportRequest,
  limit = 6,
): Promise<string> {
  if (!source) return formatKnowledge([]);
  try {
    const chunks = await source.retrieve(req, limit);
    return formatKnowledge(chunks);
  } catch (e) {
    logger.warn("knowledge retrieval failed (graceful-empty)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return formatKnowledge([]);
  }
}
