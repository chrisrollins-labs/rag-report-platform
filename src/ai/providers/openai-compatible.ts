import { ConfigError, TransportError } from "@/shared/errors";
import type { GenerateArgs, GenerateFn, GenerateResult } from "@/ai/transport";

/**
 * A transport for any OpenAI-compatible /chat/completions endpoint (OpenAI,
 * OpenRouter, a self-hosted gateway). Implemented over fetch on purpose: no
 * vendor SDK to couple to, easy to reason about, trivial to mock. Reads
 * config from the environment lazily so importing this module never requires
 * a key — a ConfigError is thrown only if you actually call it unconfigured,
 * which the graceful-empty callers treat as "AI not wired up yet".
 */

export interface OpenAiCompatibleOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createOpenAiCompatibleTransport(opts: OpenAiCompatibleOptions = {}): GenerateFn {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return async (args: GenerateArgs): Promise<GenerateResult> => {
    const baseUrl = opts.baseUrl ?? process.env.AI_API_BASE_URL;
    const apiKey = opts.apiKey ?? process.env.AI_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new ConfigError("AI_API_BASE_URL and AI_API_KEY must be configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: args.model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.prompt },
          ],
          ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
          ...(args.maxOutputTokens !== undefined ? { max_tokens: args.maxOutputTokens } : {}),
        }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new TransportError(
        `Model transport request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new TransportError(`Model provider returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new TransportError("Model response contained no message content");
    }

    return {
      text,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  };
}
