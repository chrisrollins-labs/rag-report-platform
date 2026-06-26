/**
 * Cost estimation for the usage log (ADR-008). Prices are per 1M tokens in USD.
 * An unknown model estimates 0 rather than throwing — a missing price entry
 * must never break a report, only under-report cost until the table is
 * updated. Keep this table in sync with your provider's published pricing.
 */

interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Illustrative placeholders — replace with your provider's real numbers.
  "example/model-name": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "example/model-large": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "example/embedding-small": { inputPerMillion: 0.02, outputPerMillion: 0 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price) return 0;
  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}
