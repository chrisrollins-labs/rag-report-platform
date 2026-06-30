import type { Pool } from "pg";
import type { QueryExecutor, QueryResult } from "./executor";

/**
 * The one place the pg driver is imported. Adapts a node-postgres Pool to the
 * QueryExecutor seam so the rest of the codebase never sees `pg`. The GUC that
 * scopes RLS (app.user_id) is set per checked-out connection by the caller;
 * for a request-scoped pattern, wrap acquisition in a helper that runs
 * `select set_config('app.user_id', $1, true)` before the query.
 */

export function createPgExecutor(pool: Pool): QueryExecutor {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
      const result = await pool.query(text, params as unknown[]);
      return { rows: result.rows as T[] };
    },
  };
}
