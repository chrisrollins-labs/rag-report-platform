import { z } from "zod";
import { generateStructured, type AiContext, type PromptConfig } from "../src/ai/client";
import type { ReportRequest } from "../src/reports/key";
import type { AdvisoryReport } from "../src/reports/schema";

/**
 * LLM-as-judge (ADR-010). A generated advisory is graded against a fixed
 * rubric by a judge model. The judge returns per-dimension scores and cited
 * reasoning; the overall is the MEAN of the dimensions, computed in code, not
 * a number the model is free to invent. Run this on every prompt-version or
 * model change to catch regressions the eye would miss.
 */

export const JUDGE_CONFIG: PromptConfig = {
  task: "eval_judge",
  model: process.env.AI_JUDGE_MODEL ?? process.env.AI_DEFAULT_MODEL ?? "example/model-large",
  params: { temperature: 0 },
  systemTemplate:
    "You are a strict evaluator (judge). Grade the advisory on the rubric. " +
    "Score each dimension 1 to 5 and explain briefly. Respond with a single " +
    "JSON object and nothing else.",
  userTemplate:
    "Request:\n{{request_json}}\n\n" +
    "Advisory to grade:\n{{advisory_json}}\n\n" +
    "Rubric (1-5 each): relevance (fits the subject/region/period), " +
    "actionability (could you act on it), groundedness (no invented specifics), " +
    "clarity (plain and well-organized).\n" +
    'Return JSON: { "relevance": number, "actionability": number, ' +
    '"groundedness": number, "clarity": number, "reasoning": string }',
};

export const JudgeScoreSchema = z.object({
  relevance: z.number().min(1).max(5),
  actionability: z.number().min(1).max(5),
  groundedness: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
  reasoning: z.string().min(1),
});

export type JudgeScore = z.infer<typeof JudgeScoreSchema>;

export interface JudgeResult extends JudgeScore {
  overall: number;
}

export async function runJudge(
  ai: AiContext,
  args: { request: ReportRequest; advisory: AdvisoryReport },
): Promise<JudgeResult> {
  const score = await generateStructured(
    ai,
    {
      config: JUDGE_CONFIG,
      variables: {
        request_json: JSON.stringify(args.request),
        advisory_json: JSON.stringify(args.advisory),
      },
    },
    JudgeScoreSchema,
  );
  const overall =
    (score.relevance + score.actionability + score.groundedness + score.clarity) / 4;
  return { ...score, overall: Math.round(overall * 100) / 100 };
}
