import { ConfigError, TransportError } from "@/shared/errors";

/**
 * Embedding generation for retrieval (ADR-002). Talks to any OpenAI-compatible
 * /embeddings endpoint over fetch, with the same injectable-transport
 * discipline as the chat client: fetch and sleep are parameters, so retries
 * and failures are tested without a network. A missing key raises a
 * ConfigError, which the retrieval caller treats as "RAG not wired up yet"
 * and degrades to empty rather than failing the report.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [250, 1000, 3000];

export class EmbeddingsConfigError extends ConfigError {}

export interface EmbedOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface EmbedResult {
  embeddings: number[][];
  totalTokens: number;
}

interface EmbeddingApiResponse {
  data?: { embedding?: number[] }[];
  usage?: { total_tokens?: number };
}

export async function embedTexts(texts: string[], opts: EmbedOptions = {}): Promise<EmbedResult> {
  const baseUrl = opts.baseUrl ?? process.env.AI_API_BASE_URL;
  const apiKey = opts.apiKey ?? process.env.AI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new EmbeddingsConfigError("AI_API_BASE_URL and AI_API_KEY must be configured for RAG");
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const model = opts.model ?? EMBEDDING_MODEL;
  const url = `${baseUrl.replace(/\/$/, "")}/embeddings`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1] ?? 3000);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: texts }),
      });
    } catch (e) {
      lastError = e;
      continue; // network hiccup — retry
    }

    if (RETRYABLE_STATUS.has(res.status)) {
      lastError = new TransportError(`Embeddings endpoint returned ${res.status}`);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TransportError(`Embeddings endpoint returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as EmbeddingApiResponse;
    const embeddings = (json.data ?? []).map((d) => d.embedding ?? []);
    if (embeddings.length !== texts.length || embeddings.some((e) => e.length === 0)) {
      throw new TransportError("Embeddings response did not match the requested input count");
    }
    return { embeddings, totalTokens: json.usage?.total_tokens ?? 0 };
  }

  throw new TransportError(
    `Embeddings request failed after ${BACKOFF_MS.length} retries: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
