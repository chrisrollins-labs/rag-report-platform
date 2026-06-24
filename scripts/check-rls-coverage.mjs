#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkRlsCoverage } from "./lib/rls.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "db", "migrations");

const { tables, violations } = checkRlsCoverage(migrationsDir);

if (violations.length > 0) {
  console.error("RLS coverage check FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`RLS coverage OK — ${tables.length} tables, all with RLS + a policy.`);
