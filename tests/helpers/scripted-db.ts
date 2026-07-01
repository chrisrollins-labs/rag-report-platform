import type { QueryExecutor, QueryResult } from "@/db/executor";

/**
 * A scripted QueryExecutor for tests: queue up the rows each query should
 * return, and inspect the recorded calls afterward. Mirrors the production
 * seam exactly, so store/knowledge/billing code is tested with no database.
 */
export class ScriptedExecutor implements QueryExecutor {
  readonly calls: { text: string; params?: unknown[] }[] = [];
  private readonly queue: unknown[][];

  constructor(results: unknown[][] = []) {
    this.queue = [...results];
  }

  push(rows: unknown[]): void {
    this.queue.push(rows);
  }

  async query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.calls.push({ text, ...(params ? { params } : {}) });
    const rows = (this.queue.shift() ?? []) as T[];
    return { rows };
  }
}

/** Build a fetch stand-in that returns queued Response objects in order. */
export function scriptedFetch(responses: Response[]): typeof fetch {
  const queue = [...responses];
  return (async () => {
    const next = queue.shift();
    if (!next) throw new Error("scriptedFetch ran out of responses");
    return next;
  }) as typeof fetch;
}

export const noSleep = async (): Promise<void> => {};
