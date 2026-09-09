import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moved the migration connection string out of `schema.prisma`.
 * The application itself connects through the pg driver adapter in
 * `src/server/db.ts`; this file only configures the CLI (migrate / studio).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
