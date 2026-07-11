# Structured output

Model output is validated, not trusted (ADR-005).

## Flow

1. The prompt asks for a single JSON object.
2. `extractJson` pulls the first balanced object out of the response, tolerating
   prose and ```` ```json ```` fences.
3. The result is validated against a Zod schema.
4. On a validation miss (or if extraction throws), the call retries **once**
   with a corrective suffix that tells the model what went wrong.
5. If the retry also fails, a `ValidationError` is thrown — loudly.

## Why one retry

Zero retries makes a transient formatting slip a hard failure. Unlimited retries
hide a genuinely broken prompt behind cost and latency. Exactly one absorbs the
common slip while making a real problem visible on the second failure. Both
attempts are cost-logged (ADR-008), so the worst case is a bounded, measured 2x.

## Payoff

Downstream code receives a typed, validated object and can be total — no
optional-chaining spelunking, no defensive parsing scattered across the app. The
schema is the contract, defined once (`src/reports/schema.ts`).
