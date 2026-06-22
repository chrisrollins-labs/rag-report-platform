/**
 * A small, named error taxonomy. Every thrown error in the core is one of
 * these, so callers can branch on failure kind instead of string-matching
 * messages, and the degradation strategy (ADR-004) reads clearly: a
 * ConfigError means "not wired up yet, degrade quietly"; a TransportError or
 * DependencyError means "a dependency failed, fall back"; a ValidationError
 * means "the model gave us something unusable, retry then fail loudly".
 */

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/** A network/provider transport failed (timeout, non-2xx, malformed body). */
export class TransportError extends Error {
  override readonly name = "TransportError";
}

/** Model output could not be coerced into the required schema. */
export class ValidationError extends Error {
  override readonly name = "ValidationError";
}

/** An external dependency (store, signal source) failed. */
export class DependencyError extends Error {
  override readonly name = "DependencyError";
}

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
