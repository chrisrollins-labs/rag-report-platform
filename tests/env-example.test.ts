import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the secrets policy (SECURITY.md): .env.example may carry placeholder
 * NAMES only. If a real-looking secret is ever pasted in, this test fails
 * before it can be committed. Cheap insurance against the single most common
 * credential-leak path.
 */

describe(".env.example", () => {
  const contents = readFileSync(".env.example", "utf8");
  const assignments = contents
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  it("contains only KEY=value assignments", () => {
    for (const line of assignments) {
      expect(line).toMatch(/^[A-Z0-9_]+=.+$/);
    }
  });

  it("contains no real-looking credentials", () => {
    // Common real-secret shapes: provider key prefixes, long base64-ish blobs.
    const forbidden = [/sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /[A-Za-z0-9/+]{40,}/];
    for (const line of assignments) {
      const value = line.split("=").slice(1).join("=");
      for (const pattern of forbidden) {
        expect(value).not.toMatch(pattern);
      }
    }
  });
});
