#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkMigrationOrder } from "./lib/migration-order.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "db", "migrations");

const { files, violations } = checkMigrationOrder(migrationsDir);

if (violations.length > 0) {
  console.error("Migration order check FAILED:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`Migration order OK — ${files.length} migrations, correctly ordered.`);
