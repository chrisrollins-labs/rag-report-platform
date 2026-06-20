import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The whole suite is offline by design: no test touches a real network or
 * database. Model transport and the report store are injected, so every path
 * is exercised against deterministic doubles. `pnpm test` is safe to run
 * anywhere, including CI, with no secrets configured.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
