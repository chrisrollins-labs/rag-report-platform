import type { GenerateArgs, GenerateFn, GenerateResult } from "@/ai/transport";

/**
 * A scripted transport for tests, evals, and offline demos. Hand it a queue of
 * responses (or a function of the args) and it answers deterministically while
 * recording every call it received. This is what lets the entire suite run
 * without a network or a key.
 */

export type MockResponse = string | ((args: GenerateArgs) => string);

export interface MockTransportOptions {
  /** Token counts reported for every call (cost-log assertions). */
  inputTokens?: number;
  outputTokens?: number;
}

export class MockTransport {
  readonly calls: GenerateArgs[] = [];
  private readonly queue: MockResponse[];
  private readonly opts: Required<MockTransportOptions>;

  constructor(responses: MockResponse[], opts: MockTransportOptions = {}) {
    this.queue = [...responses];
    this.opts = { inputTokens: opts.inputTokens ?? 100, outputTokens: opts.outputTokens ?? 50 };
  }

  readonly generate: GenerateFn = async (args: GenerateArgs): Promise<GenerateResult> => {
    this.calls.push(args);
    const next = this.queue.shift();
    if (next === undefined) {
      throw new Error("MockTransport ran out of scripted responses");
    }
    const text = typeof next === "function" ? next(args) : next;
    return { text, inputTokens: this.opts.inputTokens, outputTokens: this.opts.outputTokens };
  };
}

/** Convenience: a transport that always throws, to exercise failure paths. */
export function failingTransport(message = "simulated transport failure"): GenerateFn {
  return async () => {
    throw new Error(message);
  };
}
