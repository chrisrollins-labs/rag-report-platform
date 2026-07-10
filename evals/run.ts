import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAiCompatibleTransport } from "../src/ai/providers/openai-compatible";
import { MockTransport, type MockResponse } from "../src/ai/providers/mock";
import { ConsoleUsageSink, InMemoryUsageSink, type UsageSink } from "../src/ai/usage-log";
import type { GenerateArgs, GenerateFn } from "../src/ai/transport";
import { runReportPipeline } from "../src/reports/pipeline";
import { SampleKnowledgeSource } from "../src/reports/knowledge";
import { InMemoryReportStore } from "../src/reports/store";
import { TemporalSignalProvider } from "../src/signals/temporal-provider";
import type { ReportRequest } from "../src/reports/key";
import { runJudge, type JudgeResult } from "./judge";

/**
 * Eval runner (ADR-010). Generates each golden case through the real pipeline
 * and grades it with the judge, then reports per-dimension means. `--dry-run`
 * exercises the entire plumbing offline with a mock transport (no network, no
 * key), so wiring can be checked in seconds; a full run costs real model calls
 * and is manual only, never CI.
 */

const here = dirname(fileURLToPath(import.meta.url));

interface GoldenCase {
  id: string;
  request: ReportRequest;
  targetDate: string;
}

function parseArgs(argv: string[]): { dryRun: boolean; limit: number } {
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  return {
    dryRun: argv.includes("--dry-run"),
    limit: limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY,
  };
}

/** Offline responder: an advisory for base calls, a score for judge calls. */
const offlineResponder = (args: GenerateArgs): string =>
  args.system.toLowerCase().includes("judge")
    ? JSON.stringify({
        relevance: 4,
        actionability: 4,
        groundedness: 5,
        clarity: 4,
        reasoning: "Offline dry-run stub.",
      })
    : JSON.stringify({
        summary: "Stable conditions expected.",
        outlook: "Mild with a light afternoon breeze.",
        key_factors: [{ factor: "wind", detail: "Builds after midday." }],
        recommendations: ["Favor sheltered pockets in the afternoon."],
      });

function buildTransport(dryRun: boolean, caseCount: number): GenerateFn {
  if (!dryRun) return createOpenAiCompatibleTransport();
  // Two model calls per case (base generation + judge); the responder decides
  // which shape to return from the call's system prompt.
  const responses: MockResponse[] = Array.from({ length: caseCount * 2 }, () => offlineResponder);
  return new MockTransport(responses).generate;
}

async function main(): Promise<void> {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  const cases: GoldenCase[] = (
    JSON.parse(readFileSync(join(here, "golden", "cases.json"), "utf8")) as GoldenCase[]
  ).slice(0, limit);

  const sink: UsageSink = dryRun ? new InMemoryUsageSink() : new ConsoleUsageSink();
  const ai = { generate: buildTransport(dryRun, cases.length), sink };
  const results: { id: string; judge: JudgeResult }[] = [];

  for (const gc of cases) {
    const report = await runReportPipeline(
      {
        ai,
        store: new InMemoryReportStore(),
        providers: [new TemporalSignalProvider()],
        knowledge: new SampleKnowledgeSource(),
      },
      gc.request,
      gc.targetDate,
    );
    const judged = await runJudge(ai, { request: gc.request, advisory: report.advisory });
    results.push({ id: gc.id, judge: judged });
    console.log(`  ${gc.id}: overall ${judged.overall}`);
  }

  const mean = (pick: (j: JudgeResult) => number): number =>
    Math.round((results.reduce((s, r) => s + pick(r.judge), 0) / results.length) * 100) / 100;

  const means = {
    overall: mean((j) => j.overall),
    relevance: mean((j) => j.relevance),
    actionability: mean((j) => j.actionability),
    groundedness: mean((j) => j.groundedness),
    clarity: mean((j) => j.clarity),
  };
  console.log("\nAggregate:", JSON.stringify(means));

  if (!dryRun) {
    const outDir = join(here, "results");
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `run-${process.env.EVAL_RUN_ID ?? "latest"}.json`);
    writeFileSync(file, JSON.stringify({ means, results }, null, 2));
    console.log(`Wrote ${file}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
