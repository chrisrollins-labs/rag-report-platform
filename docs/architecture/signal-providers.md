# Signal providers

Live external data enters a report through one interface, `SignalProvider`. This
is the design upgrade over hardcoding vendor calls: adding a data source is
implementing an interface and registering it, not editing the pipeline.

```ts
interface SignalProvider {
  readonly name: string;
  fetch(ctx: SignalContext): Promise<SignalResult | null>;
}
```

## The optional contract

Every provider returns a value or `null`. A `null` — from missing coordinates, a
non-2xx response, or a thrown fetch — means the signal is simply absent from the
report. No provider can fail the report (ADR-004). The pipeline gathers all
providers concurrently and records which came back empty in `missingSignals`.

## Two reference providers

- **Temporal** (`temporal-provider.ts`) is fully deterministic: season and
  daylight derived from the date with pure computation, no network. It exists so
  that at least one signal always resolves, and it is the easiest possible thing
  to test.
- **Weather** (`weather-provider.ts`) is network-backed over an open forecast
  API. It needs coordinates and degrades to `null` without them or on any
  failure. `fetch` is injected, so it is tested offline.

## Adding a provider

Implement the interface, register the instance in `runtime.ts`. That is the
whole change. Tides, air quality, public advisories, or a proprietary feed all
fit the same shape.
