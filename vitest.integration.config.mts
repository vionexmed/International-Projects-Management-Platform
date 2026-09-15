import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/**
 * The suites that talk to a real PostgreSQL. Kept separate from the unit
 * config so that `test:unit` — which includes the supplier-scope tests, the
 * most valuable in the repository — stays runnable with no infrastructure at
 * all, while these fail loudly when the database is missing.
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/setup-integration.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one database; run files serially.
    fileParallelism: false,
  },
});
