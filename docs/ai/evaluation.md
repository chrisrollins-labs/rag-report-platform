# Evaluation

Quality is measured, not felt (ADR-010).

## What runs

`evals/run.ts` generates each golden case through the real pipeline and grades
the result with an LLM-as-judge (`evals/judge.ts`). The judge scores four
dimensions 1–5; the overall is their mean, computed in code.

## Rubric

- **relevance** — fits the subject, region, and period.
- **actionability** — could you act on it.
- **groundedness** — no invented specifics beyond provided knowledge.
- **clarity** — plain, organized, no filler.

## Running

```bash
npm run eval:dry     # offline, mock transport, seconds — validates wiring
npm run eval         # real model calls, manual only, writes a results artifact
```

A full run costs real calls and is never part of CI. It writes a results file
with per-case scores and reasoning; commit it so the next run diffs against it.

## Discipline

The golden set is a fixed yardstick — changing it casually breaks comparability.
The judge is itself a model, so its reasoning is committed and score movements
above a threshold get a human look. Run it on every prompt-version bump or model
swap; that is when regressions sneak in.
