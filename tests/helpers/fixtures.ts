import type { AdvisoryReport } from "@/reports/schema";

/** A valid advisory as the model would return it. */
export const VALID_ADVISORY: AdvisoryReport = {
  summary: "Stable conditions expected through the period.",
  outlook: "Mild with occasional afternoon wind.",
  key_factors: [{ factor: "wind", detail: "Onshore flow strengthens after midday." }],
  recommendations: ["Favor sheltered, lee-side pockets in the afternoon."],
};

export const VALID_ADVISORY_JSON = JSON.stringify(VALID_ADVISORY);

/** Same content wrapped in a markdown fence, to exercise extraction. */
export const FENCED_ADVISORY = "```json\n" + VALID_ADVISORY_JSON + "\n```";

/** Missing required fields — fails the schema. */
export const INVALID_ADVISORY_JSON = JSON.stringify({ summary: "incomplete" });

/** A valid overlay as the model would return it. */
export const VALID_OVERLAY_JSON = JSON.stringify({
  today_outlook: "Near-term conditions hold steady with a light afternoon breeze.",
  highlights: [{ window: "early morning", note: "Calmest water before the breeze builds." }],
  adjustments: ["Shift plans earlier in the day."],
});
