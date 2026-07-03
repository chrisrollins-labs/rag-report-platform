import { describe, expect, it } from "vitest";
import { chunkText } from "@/rag/chunking";

describe("chunkText", () => {
  it("returns one chunk for a short single paragraph", () => {
    expect(chunkText("A short passage.")).toEqual(["A short passage."]);
  });

  it("packs paragraphs up to the character budget", () => {
    const para = "word ".repeat(40).trim(); // ~199 chars
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, { maxChars: 250 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(250 + para.length);
  });

  it("normalizes whitespace within a chunk", () => {
    const chunks = chunkText("line one\n   line two");
    expect(chunks[0]).toBe("line one line two");
  });

  it("folds a tiny trailing chunk back into its predecessor", () => {
    const big = "x".repeat(800);
    const tiny = "tail";
    const chunks = chunkText(`${big}\n\n${tiny}`, { maxChars: 850, minChars: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.endsWith("tail")).toBe(true);
  });
});
