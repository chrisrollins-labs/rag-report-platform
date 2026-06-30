/**
 * The database seam. Everything that touches Postgres depends on this narrow
 * interface, never on a concrete driver. Production wires a pg Pool adapter
 * (src/db/pg-executor.ts); tests wire a scripted executor. This is why the
 * store, usage sink, and knowledge source are all unit-testable with no
 * database and no network.
 */

export interface QueryResult<T> {
  rows: T[];
}

export interface QueryExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}
