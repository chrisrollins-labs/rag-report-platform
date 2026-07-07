import { type AiContext } from "@/ai/client";
import { createOpenAiCompatibleTransport } from "@/ai/providers/openai-compatible";
import { ConsoleUsageSink } from "@/ai/usage-log";
import { TemporalSignalProvider } from "@/signals/temporal-provider";
import { WeatherSignalProvider } from "@/signals/weather-provider";
import type { SignalProvider } from "@/signals/provider";
import { InMemoryConditionsCache, type ConditionsCache } from "./conditions-cache";
import { SampleKnowledgeSource, type KnowledgeSource } from "./knowledge";
import { InMemoryReportStore, type ReportStore } from "./store";
import type { PipelineDeps } from "./pipeline";

/**
 * Composition root for the running app. This is the ONE place concrete
 * implementations get chosen; everything else depends on interfaces. Swapping
 * the in-memory store for a Postgres-backed one, or adding a weather signal
 * provider, happens here and nowhere else.
 *
 * The store is a module singleton so the L1 cache survives across requests in
 * a single server process (a real deployment uses the database instead).
 */

let sharedStore: ReportStore | null = null;
let sharedCache: ConditionsCache | null = null;

function getStore(): ReportStore {
  sharedStore ??= new InMemoryReportStore();
  return sharedStore;
}

function getCache(): ConditionsCache {
  sharedCache ??= new InMemoryConditionsCache();
  return sharedCache;
}

export function buildPipelineDeps(): PipelineDeps {
  const ai: AiContext = {
    generate: createOpenAiCompatibleTransport(),
    sink: new ConsoleUsageSink(),
  };
  // Temporal always resolves (deterministic); weather resolves only when the
  // request carries coordinates, and degrades to absent otherwise.
  const providers: SignalProvider[] = [new TemporalSignalProvider(), new WeatherSignalProvider()];
  const knowledge: KnowledgeSource = new SampleKnowledgeSource();

  return { ai, store: getStore(), providers, knowledge, conditionsCache: getCache() };
}
