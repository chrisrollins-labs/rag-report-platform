import { describe, expect, it } from "vitest";
import { EmbeddingsConfigError, embedTexts } from "@/rag/embeddings";
import { noSleep, scriptedFetch } from "../helpers/scripted-db";

const CREDS = { baseUrl: "https://api.example-provider.com/v1", apiKey: "test-key" };

function embeddingResponse(status = 200): Response {
  return new Response(
    JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }], usage: { total_tokens: 5 } }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("embedTexts", () => {
  it("returns embeddings and token usage on success", async () => {
    const result = await embedTexts(["hello"], {
      ...CREDS,
      fetchImpl: scriptedFetch([embeddingResponse()]),
      sleep: noSleep,
    });
    expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(result.totalTokens).toBe(5);
  });

  it("throws EmbeddingsConfigError when no credentials are configured", async () => {
    const noEnv = { ...process.env };
    delete process.env.AI_API_BASE_URL;
    delete process.env.AI_API_KEY;
    try {
      await expect(embedTexts(["hello"], { sleep: noSleep })).rejects.toBeInstanceOf(
        EmbeddingsConfigError,
      );
    } finally {
      Object.assign(process.env, noEnv);
    }
  });

  it("retries a 429 and then succeeds", async () => {
    const result = await embedTexts(["hello"], {
      ...CREDS,
      fetchImpl: scriptedFetch([embeddingResponse(429), embeddingResponse(200)]),
      sleep: noSleep,
    });
    expect(result.embeddings).toHaveLength(1);
  });

  it("rejects when the response count does not match the input count", async () => {
    const mismatched = new Response(JSON.stringify({ data: [], usage: { total_tokens: 0 } }), {
      status: 200,
    });
    await expect(
      embedTexts(["a", "b"], { ...CREDS, fetchImpl: scriptedFetch([mismatched]), sleep: noSleep }),
    ).rejects.toThrow(/did not match/i);
  });
});
