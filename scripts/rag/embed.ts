import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chunkText } from "../../src/rag/chunking";
import { embedTexts } from "../../src/rag/embeddings";

/**
 * Corpus seeding CLI (ADR-002). Reads the sample corpus manifest, chunks each
 * document, and (in a live run) embeds the chunks ready for upsert into
 * rag.documents + rag.chunks. `--dry-run` stays fully offline: it reports the
 * chunk plan without embedding, so the pipeline can be validated with no key
 * and no database. A live run is owner-operated and costs embedding calls; it
 * is never part of CI.
 */

const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, "..", "..", "examples", "sample-corpus");

interface ManifestEntry {
  file: string;
  title: string;
  subject: string;
  source: string;
  tags: string[];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const manifest = JSON.parse(
    readFileSync(join(corpusDir, "manifest.json"), "utf8"),
  ) as ManifestEntry[];

  let totalChunks = 0;
  for (const doc of manifest) {
    const text = readFileSync(join(corpusDir, doc.file), "utf8");
    const chunks = chunkText(text);
    totalChunks += chunks.length;
    console.log(`${doc.file}: ${chunks.length} chunks (subject=${doc.subject})`);

    if (!dryRun) {
      const { embeddings, totalTokens } = await embedTexts(chunks);
      console.log(
        `  embedded ${embeddings.length} chunks (${totalTokens} tokens); ` +
          "ready to upsert into rag.documents + rag.chunks via the QueryExecutor.",
      );
    }
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}Total chunks: ${totalChunks}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
