import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * RLS coverage check (ADR-007). Statically parses the migration SQL and
 * asserts that every table created in an application schema has BOTH row-level
 * security enabled AND at least one policy — in the migrations, not just "in
 * production". This is the gate that makes tenant isolation provably present
 * instead of aspirational.
 *
 * A table may legitimately need an exception (documented in ALLOWLIST); a
 * silent skip is never allowed.
 */

const APP_SCHEMAS = ["public", "rag"];

/** Tables intentionally exempt from RLS, with a reason. Keep this empty-ish. */
const ALLOWLIST = new Set([
  // "public.some_reference_table", // static reference data, read-only
]);

const CREATE_TABLE = /create table (?:if not exists )?([a-z_]+\.[a-z_]+)/gi;
const ENABLE_RLS = /alter table ([a-z_]+\.[a-z_]+) enable row level security/gi;
const CREATE_POLICY = /create policy [a-z_0-9]+ on ([a-z_]+\.[a-z_]+)/gi;

function collect(regex, sql, sink) {
  let m;
  while ((m = regex.exec(sql)) !== null) sink.add(m[1].toLowerCase());
}

export function checkRlsCoverage(migrationsDir) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const created = new Set();
  const rlsEnabled = new Set();
  const policied = new Set();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    collect(CREATE_TABLE, sql, created);
    collect(ENABLE_RLS, sql, rlsEnabled);
    collect(CREATE_POLICY, sql, policied);
  }

  const violations = [];
  for (const table of created) {
    const [schema] = table.split(".");
    if (!APP_SCHEMAS.includes(schema)) continue;
    if (ALLOWLIST.has(table)) continue;
    if (!rlsEnabled.has(table)) violations.push(`${table}: RLS not enabled`);
    if (!policied.has(table)) violations.push(`${table}: no policy defined`);
  }

  return { tables: [...created], violations };
}
