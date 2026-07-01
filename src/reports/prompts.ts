import type { PromptConfig } from "@/ai/client";

/**
 * In production these live in a `prompt_configs` table, versioned and audited
 * (ADR-006), and are loaded by task at request time so a model or wording
 * change is a reviewable data change, never a code deploy. For this reference
 * slice the active config is defined here to keep the path self-contained —
 * the shape is identical to the row a loader would return.
 *
 * The template is deliberately generic and carries no proprietary wording.
 */

export const ADVISORY_OVERLAY_CONFIG: PromptConfig = {
  task: "advisory_overlay",
  model: process.env.AI_DEFAULT_MODEL ?? "example/model-name",
  params: { temperature: 0.3, maxOutputTokens: 700 },
  systemTemplate:
    "You adjust a durable advisory for near-term conditions. Use only the " +
    "provided live signals. Respond with a single JSON object and nothing else.",
  userTemplate:
    "Durable outlook:\n{{base_summary}}\n\n" +
    "Live signals for {{target_date}} in {{region}}:\n{{signals_json}}\n\n" +
    'Return JSON: { "today_outlook": string, ' +
    '"highlights": [{ "window": string, "note": string }], "adjustments": [string] }',
};

export const ADVISORY_BASE_CONFIG: PromptConfig = {
  task: "advisory_base",
  model: process.env.AI_DEFAULT_MODEL ?? "example/model-name",
  params: { temperature: 0.4, maxOutputTokens: 1200 },
  systemTemplate:
    "You are an analyst writing a concise, grounded advisory. Use only the " +
    "provided knowledge and signals. Never invent specifics. Respond with a " +
    "single JSON object and nothing else.",
  userTemplate:
    "Write a durable, season-level advisory.\n\n" +
    "Subject: {{subject}}\n" +
    "Region: {{region}}\n" +
    "Period: {{period}}\n\n" +
    "Curated knowledge:\n{{knowledge}}\n\n" +
    "Return JSON with this exact shape:\n" +
    '{ "summary": string, "outlook": string, ' +
    '"key_factors": [{ "factor": string, "detail": string }], ' +
    '"recommendations": [string] }',
};
