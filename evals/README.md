# Evaluation harness

Prompt and model changes are graded against a committed golden set by an
LLM-as-judge (ADR-010), so a regression shows up as a number, not a surprise in
production.

## Files

- `golden/cases.json` — a fixed set of request cases spanning subjects,
  regions, and seasons. It is a yardstick: do not hand-edit it casually, or the
  numbers stop being comparable across runs.
- `judge.ts` — the judge config and rubric. The judge scores each dimension
  1–5; the overall is the mean, computed in code, never a number the model
  invents.
- `run.ts` — the runner.

## Running

```bash
npm run eval:dry        # offline plumbing check — no network, no key, seconds
npm run eval            # full run — real model calls, manual only, never CI
npm run eval -- --limit=3
```

A full run writes a results artifact under `results/` with per-case scores and
the judge's reasoning. Commit it, so the next run has something to diff against.

## Rubric

- **relevance** — fits the subject, region, and period.
- **actionability** — could you act on it.
- **groundedness** — no invented specifics beyond the provided knowledge.
- **clarity** — plain, well-organized, no filler.

Run this on every prompt-version bump or model swap. The judge config itself
lives in versioned prompt configuration, so it is auditable like every other
prompt (ADR-006).
