/**
 * Tag derivation for retrieval filters. Retrieval is scoped by subject and
 * narrowed by tags (region, period/season) so the vector search returns
 * context that is topically relevant, not just embedding-close. These helpers
 * turn free-form request fields into the normalized tags stored on chunks.
 */

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SEASON_BY_MONTH: Record<number, string> = {
  12: "winter", 1: "winter", 2: "winter",
  3: "spring", 4: "spring", 5: "spring",
  6: "summer", 7: "summer", 8: "summer",
  9: "autumn", 10: "autumn", 11: "autumn",
};

/** Season tag for a 1–12 month, or [] if out of range. */
export function seasonTags(month: number): string[] {
  const season = SEASON_BY_MONTH[month];
  return season ? [season] : [];
}

export interface QueryTagInput {
  subject: string;
  region: string;
  period: string;
  month?: number;
}

/** The tag set used to filter retrieval for a request. */
export function tagsForQuery(input: QueryTagInput): string[] {
  const tags = [normalizeTag(input.region), normalizeTag(input.period)];
  if (input.month) tags.push(...seasonTags(input.month));
  return [...new Set(tags.filter(Boolean))];
}

/** The natural-language text embedded for a retrieval query. */
export function buildQueryText(input: QueryTagInput): string {
  return `${input.subject} in ${input.region} during ${input.period}`;
}
