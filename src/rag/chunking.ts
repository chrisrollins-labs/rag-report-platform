/**
 * Document chunking for the corpus. Splits on paragraph boundaries and packs
 * paragraphs up to a character budget, so a chunk is a coherent passage rather
 * than an arbitrary window. Keeping chunks paragraph-aligned improves both
 * embedding quality and the readability of retrieved context.
 */

export interface ChunkOptions {
  maxChars?: number;
  minChars?: number;
}

const DEFAULT_MAX = 900;
const DEFAULT_MIN = 120;

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX;
  const minChars = opts.minChars ?? DEFAULT_MIN;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current && current.length + para.length + 1 > maxChars) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current} ${para}` : para;
    }
  }
  if (current) chunks.push(current);

  // Fold a too-small trailing chunk back into its predecessor.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1]!;
    if (last.length < minChars) {
      chunks[chunks.length - 2] = `${chunks[chunks.length - 2]} ${last}`;
      chunks.pop();
    }
  }
  return chunks;
}
