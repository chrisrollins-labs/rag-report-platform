import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

/**
 * Apply the migrations in db/migrations to DATABASE_URL, in filename order,
 * inside a single transaction. This is for local development against a fresh
 * database (see docker-compose.yml); the default app runtime uses the in-memory
 * backend and needs no database at all. Migrations are the single source of
 * schema truth (ADR-012): this runner never edits schema, it only applies the
 * committed SQL.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required (see .env.example).");
    process.exit(1);
  }

  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin");
    for (const file of files) {
      process.stdout.write(`applying ${file} ... `);
      await client.query(readFileSync(join(dir, file), "utf8"));
      console.log("ok");
    }
    await client.query("commit");
    console.log(`Applied ${files.length} migrations.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
