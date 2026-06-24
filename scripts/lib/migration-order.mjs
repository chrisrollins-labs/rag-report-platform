import { readdirSync } from "node:fs";

/**
 * Migration order check (ADR-012). Migrations must be appended, never inserted
 * between existing ones: filenames are NNNN_name.sql with strictly increasing,
 * unique numeric prefixes. Inserting a lower-numbered migration after peers
 * have applied higher ones is how environments drift; this gate blocks it.
 */

const NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

export function checkMigrationOrder(migrationsDir) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const violations = [];
  const seen = new Set();
  let previous = -1;

  for (const file of files) {
    const match = NAME.exec(file);
    if (!match) {
      violations.push(`${file}: does not match NNNN_name.sql`);
      continue;
    }
    const n = Number(match[1]);
    if (seen.has(n)) violations.push(`${file}: duplicate migration number ${match[1]}`);
    if (n <= previous) violations.push(`${file}: number ${match[1]} is not strictly increasing`);
    seen.add(n);
    previous = n;
  }

  return { files, violations };
}
