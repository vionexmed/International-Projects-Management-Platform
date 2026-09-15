import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved the migration connection string out of `schema.prisma`.
 * The application itself connects through the pg driver adapter in
 * `src/server/db.ts`; this file only configures the CLI (migrate / studio).
 *
 * Migrations prefer DIRECT_URL. Managed providers expose a transaction-mode
 * pooler for the app and a direct port for schema changes; `prisma migrate`
 * needs session-level advisory locks, which a transaction pooler cannot give.
 *
 * The datasource is declared only when a URL is actually present. `prisma
 * generate` runs during `npm install` on the build machine, where no database
 * variables exist yet — and Prisma's `env()` helper resolves eagerly and
 * throws, which would fail the install before the app is ever built.
 * Generating the client needs no connection, so omitting the block is correct.
 */
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

/**
 * Only used by `prisma migrate diff --from-migrations`, which replays the
 * whole history into a scratch database to compare it with `schema.prisma`.
 * Set by `scripts/migration-proof.mjs`; absent everywhere else, because a
 * shadow database is a tool for verifying migrations, never for running them.
 */
const shadowUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(migrationUrl
    ? {
        datasource: {
          url: migrationUrl,
          ...(shadowUrl ? { shadowDatabaseUrl: shadowUrl } : {}),
        },
      }
    : {}),
});
