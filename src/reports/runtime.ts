import { Pool } from "pg";
import { type AiContext } from "@/ai/client";
import { createOpenAiCompatibleTransport } from "@/ai/providers/openai-compatible";
import { ConsoleUsageSink } from "@/ai/usage-log";
import { PgUsageSink } from "@/ai/pg-usage-sink";
import { createPgExecutor } from "@/db/pg-executor";
import { ConfigError } from "@/shared/errors";
import { TemporalSignalProvider } from "@/signals/temporal-provider";
import { WeatherSignalProvider } from "@/signals/weather-provider";
import type { SignalProvider } from "@/signals/provider";
import { InMemoryConditionsCache, type ConditionsCache } from "./conditions-cache";
import { SampleKnowledgeSource, type KnowledgeSource } from "./knowledge";
import { PgKnowledgeSource } from "./pg-knowledge";
import { InMemoryReportStore, type ReportStore } from "./store";
import { PgReportStore } from "./pg-store";
import type { PipelineDeps } from "./pipeline";

/**
 * Composition root for the running app. This is the ONE place concrete
 * implementations get chosen; everything else depends on interfaces.
 *
 * Default: in-memory store, cache, knowledge, and a console usage sink, so the
 * app runs with zero infrastructure. Set REPORT_STORE=postgres (with a
 * DATABASE_URL) to swap in the Postgres-backed report store, the pgvector
 * knowledge source, and the ai_usage_log sink. Bring up a local database with
 * `docker compose up -d` and apply the schema with `npm run db:migrate`.
 *
 * The in-memory store/cache are module singletons so the L1 cache survives
 * across requests in a single server process; the Postgres path uses one shared
 * connection pool instead.
 */

function postgresEnabled(): boolean {
  return process.env.REPORT_STORE === "postgres";
}


let sharedStore: ReportStore | null = null;
let sharedCache: ConditionsCache | null = null;
let sharedPool: Pool | null = null;

function getPool(): Pool {
  if (!sharedPool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new ConfigError("REPORT_STORE=postgres requires DATABASE_URL (see .env.example).");
    }
    sharedPool = new Pool({ connectionString: url });
  }
  return sharedPool;
}

function getStore(): ReportStore {
  sharedStore ??= new InMemoryReportStore();
  return sharedStore;
}

function getCache(): ConditionsCache {
  sharedCache ??= new InMemoryConditionsCache();
  return sharedCache;
}

export function buildPipelineDeps(): PipelineDeps {
  // Temporal always resolves (deterministic); weather resolves only when the
  // request carries coordinates, and degrades to absent otherwise.
  const providers: SignalProvider[] = [new TemporalSignalProvider(), new WeatherSignalProvider()];

  if (postgresEnabled()) {
    const db = createPgExecutor(getPool());
    const ai: AiContext = {
      generate: createOpenAiCompatibleTransport(),
      sink: new PgUsageSink(db),
    };
    // report_bases and ai_usage_log live in Postgres; the pgvector corpus is the
    // knowledge source. The conditions cache stays in-memory: it is a short-TTL
    // ephemeral cache with no Postgres adapter in this reference.
    return {
      ai,
      store: new PgReportStore(db),
      providers,
      knowledge: new PgKnowledgeSource(db),
      conditionsCache: getCache(),
    };
  }

  const ai: AiContext = {
    generate: createOpenAiCompatibleTransport(),
    sink: new ConsoleUsageSink(),
  };
  const knowledge: KnowledgeSource = new SampleKnowledgeSource();
  return { ai, store: getStore(), providers, knowledge, conditionsCache: getCache() };
}
