import { describe, expect, it } from "vitest";
import { buildQueryText, normalizeTag, seasonTags, tagsForQuery } from "@/rag/tags";

describe("tag helpers", () => {
  it("normalizes tags to lowercase hyphenated slugs", () => {
    expect(normalizeTag("Central Gulf Coast")).toBe("central-gulf-coast");
    expect(normalizeTag("  Trailing/Slashes  ")).toBe("trailing-slashes");
  });

  it("maps months to seasons and rejects out-of-range", () => {
    expect(seasonTags(7)).toEqual(["summer"]);
    expect(seasonTags(1)).toEqual(["winter"]);
    expect(seasonTags(13)).toEqual([]);
  });

  it("builds a deduplicated tag set for a query", () => {
    const tags = tagsForQuery({
      subject: "coastal site conditions",
      region: "central gulf coast",
      period: "october",
      month: 10,
    });
    expect(tags).toContain("central-gulf-coast");
    expect(tags).toContain("october");
    expect(tags).toContain("autumn");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("builds readable query text", () => {
    expect(
      buildQueryText({ subject: "conditions", region: "gulf", period: "october" }),
    ).toBe("conditions in gulf during october");
  });
});
