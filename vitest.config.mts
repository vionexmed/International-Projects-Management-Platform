import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` guards RSC boundaries at build time; under Vitest the
      // services run in plain Node, so it is stubbed out.
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    // Unit suites only: no database, no storage, nothing to start first.
    // The integration suites have their own config, which refuses to run
    // without a reachable database instead of skipping.
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one database; run files serially.
    fileParallelism: false,
  },
});
