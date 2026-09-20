#!/usr/bin/env node
/**
 * Proves that an empty PostgreSQL can become the Vionex Projects schema using
 * nothing but the migration history.
 *
 *   npm run db:proof
 *
 * Why this exists as a script and not as a thing somebody remembers to do:
 * the development database was migrated incrementally, one `migrate dev` at a
 * time, over weeks. That tells you nothing about whether the *history* works —
 * a migration can depend on a column an earlier one only created by accident,
 * or on data that happens to be there. The first time anybody finds out is
 * when a new environment is created, which is exactly the moment when being
 * wrong is most expensive.
 *
 * So: create a throwaway database, apply every migration forward-only, and
 * check that what comes out matches the schema the application expects.
 *
 * It never touches an existing database. The database it creates is named with
 * a timestamp and dropped at the end, including on failure.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";
import process from "node:process";
// The script is run from a shell, not by Next, so nothing has loaded .env yet.
import "dotenv/config";

const ADMIN_URL = process.env.PROOF_ADMIN_URL ?? process.env.DATABASE_URL;

if (!ADMIN_URL) {
  console.error(
    "✗ No DATABASE_URL. Point PROOF_ADMIN_URL or DATABASE_URL at a PostgreSQL\n" +
      "  server where a throwaway database may be created (npm run db:start).",
  );
  process.exit(1);
}

const stamp = Date.now();
const name = `vionex_proof_${stamp}`;
/**
 * A second scratch database, used only by `migrate diff --from-migrations`:
 * Prisma replays the history into it to compare the result with
 * `schema.prisma`. Kept separate from the one being proven so the comparison
 * cannot be contaminated by it.
 */
const shadowName = `vionex_proof_shadow_${stamp}`;

const target = new URL(ADMIN_URL);
target.pathname = `/${name}`;
const shadow = new URL(ADMIN_URL);
shadow.pathname = `/${shadowName}`;

/** Tables the application cannot work without, whatever else exists. */
const REQUIRED_TABLES = [
  "Organization",
  "Supplier",
  "User",
  "Project",
  "ProjectStage",
  "Milestone",
  "Task",
  "TaskComment",
  "Document",
  "DocumentVersion",
  "DocumentRequest",
  "DocumentRequestReply",
  "DocumentRequestReview",
  "ClinicalStudy",
  "ImportShipment",
  "MessageThread",
  "Message",
  "MessageAttachment",
  "MessageRead",
  "TimelineEvent",
  "Notification",
  "AuditLog",
  "LoginAttempt",
];

/** Enums whose absence would only surface at the first write. */
const REQUIRED_ENUMS = [
  "UserRole",
  "StageKey",
  "DocumentType",
  "DocumentVisibility",
  "ReviewDecision",
  "NotificationType",
  // The status vocabulary was unified in 20260920122153: HealthStatus
  // (Project/Supplier), DocumentCycleStatus (Document/DocumentRequest) and
  // ProgressStatus (Stage/Milestone/ClinicalStudy/Task) replaced ten
  // separate, mostly-overlapping enums.
  "HealthStatus",
  "DocumentCycleStatus",
  "ProgressStatus",
];

const admin = new pg.Client({ connectionString: ADMIN_URL });

async function main() {
  await admin.connect();

  console.log(`→ Criando bancos descartáveis…`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.query(`CREATE DATABASE "${shadowName}"`);

  console.log("→ Aplicando migrations (forward-only)…");
  const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: target.toString(), DIRECT_URL: target.toString() },
  });
  if (deploy.status !== 0) throw new Error("prisma migrate deploy falhou.");

  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();

  try {
    const { rows: migrations } = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at
         FROM "_prisma_migrations"
        ORDER BY started_at`,
    );

    const applied = migrations.filter((row) => row.finished_at && !row.rolled_back_at);
    console.log(`  ${applied.length} migration(s) aplicadas:`);
    for (const row of applied) console.log(`    · ${row.migration_name}`);

    if (applied.length !== migrations.length) {
      throw new Error("Alguma migration não terminou ou foi revertida.");
    }

    const { rows: tables } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const present = new Set(tables.map((row) => row.tablename));
    const missingTables = REQUIRED_TABLES.filter((table) => !present.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Tabelas ausentes: ${missingTables.join(", ")}`);
    }

    const { rows: enums } = await client.query(
      `SELECT typname FROM pg_type WHERE typtype = 'e'`,
    );
    const enumNames = new Set(enums.map((row) => row.typname));
    const missingEnums = REQUIRED_ENUMS.filter((value) => !enumNames.has(value));
    if (missingEnums.length > 0) {
      throw new Error(`Enums ausentes: ${missingEnums.join(", ")}`);
    }

    const { rows: constraints } = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND c.contype = 'f'`,
    );

    /**
     * The foreign keys are the part of this schema that carries meaning:
     * `Restrict` is how the product refuses to delete somebody who produced
     * work, which is what keeps the history attributable. A database whose
     * tables exist without them would pass a shallow check and lose that.
     */
    if (constraints[0].count < 40) {
      throw new Error(`Apenas ${constraints[0].count} foreign keys — esperado 40+.`);
    }

    /**
     * `prisma migrate diff` compares the migrated database against
     * `schema.prisma`. Empty output means the history alone reproduces the
     * schema the application was compiled against — the actual claim being
     * made here.
     */
    console.log("→ Comparando com schema.prisma…");
    const diff = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-migrations",
        "prisma/migrations",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: target.toString(),
          DIRECT_URL: target.toString(),
          SHADOW_DATABASE_URL: shadow.toString(),
        },
      },
    );

    if (diff.status === 2) {
      console.error(diff.stdout || diff.stderr);
      throw new Error("O banco migrado difere de schema.prisma.");
    }
    if (diff.status !== 0) {
      throw new Error(`prisma migrate diff falhou: ${diff.stderr}`);
    }

    console.log(
      `\n✓ Um banco vazio vira a Vionex Projects só com as migrations.\n` +
        `  ${applied.length} migrations · ${present.size} tabelas · ${enumNames.size} enums · ` +
        `${constraints[0].count} foreign keys · sem diferença para schema.prisma`,
    );
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  // Always dropped, including on failure: the point is the proof, not the
  // database.
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS "${shadowName}" WITH (FORCE)`);
    console.log(`  bancos descartáveis removidos`);
  } catch (error) {
    console.error(`! não foi possível remover ${name}: ${error.message}`);
  }
  await admin.end();
}
