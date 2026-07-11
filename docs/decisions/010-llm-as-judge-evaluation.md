# 010 — LLM-as-judge evaluation against a committed golden set

**Status:** Accepted

## Context

Prompt and model changes affect output quality in ways that are easy to feel and
hard to measure. Shipping a change on vibes means regressions ride along
undetected until a user notices.

## Decision

Grade generated output against a committed golden set with an LLM-as-judge. The
judge scores each case on a fixed rubric (relevance, actionability,
groundedness, clarity); the overall is the mean of the dimensions, computed in
code, not a number the judge invents. Runs are manual (they cost real model
calls) and write a versioned results artifact with the judge's reasoning, so
successive runs are diffable.

## Consequences

- A prompt or model change produces a number, and a regression is visible before
  it ships.
- The golden set is a fixed yardstick; changing it casually breaks comparability,
  so it is treated as a controlled artifact.
- The judge is itself a model and imperfect; the rubric and committed reasoning
  keep its judgments auditable, and a human reviews score movements above a
  threshold.
