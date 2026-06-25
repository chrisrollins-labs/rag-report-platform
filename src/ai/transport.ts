/**
 * The transport contract (ADR-001). This is the seam every model call passes
 * through. Production wires an OpenAI-compatible transport; tests wire a
 * scripted mock. The rest of the system depends on this interface, never on a
 * concrete provider SDK, so swapping vendors is a one-file change and the
 * whole suite runs with zero network.
 */

export interface GenerateArgs {
  model: string;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type GenerateFn = (args: GenerateArgs) => Promise<GenerateResult>;
