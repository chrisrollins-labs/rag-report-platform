/**
 * Pull a JSON object out of a model response. Models wrap JSON in prose or
 * ```json fences despite instructions; this extracts the first balanced
 * object rather than trusting the whole string to be clean. It does NOT
 * validate shape — that is the caller's Zod schema's job (ADR-005).
 */

export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Fast path: the whole thing is already JSON.
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to fence/brace extraction
  }

  // Strip a ```json ... ``` (or bare ``` ... ```) fence if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  // Otherwise, take the first balanced {...} span.
  const start = candidate.indexOf("{");
  if (start === -1) throw new SyntaxError("No JSON object found in model output");

  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }
  throw new SyntaxError("Unterminated JSON object in model output");
}
