import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moved the migration connection string out of `schema.prisma`.
 * The application itself connects through the pg driver adapter in
 * `src/server/db.ts`; this file only configures the CLI (migrate / studio).
 *
 * Migrations use DIRECT_URL when present. Managed providers expose a
 * transaction-mode pooler for the app and a direct port for schema changes;
 * `prisma migrate` needs session-level advisory locks, which a transaction
 * pooler cannot give it.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
