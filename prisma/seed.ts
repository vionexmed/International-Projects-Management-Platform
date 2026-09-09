import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { createLocalDriver } from "../src/lib/storage/local";
import { createS3Driver } from "../src/lib/storage/s3";
import type { StorageDriver } from "../src/lib/storage/types";
import { seedDemoData } from "../src/server/demo/seed-data";

/**
 * CLI entry point for the demonstration dataset.
 *
 * The data itself lives in `src/server/demo/seed-data.ts`, shared with the
 * embedded database — so a deployment running with no Postgres and one seeded
 * by hand show exactly the same thing.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const db = createClient();

/**
 * A database that is not on this machine is treated as shared: seeding it
 * truncates every table, so it must be confirmed explicitly and must not be
 * given the published development password.
 */
function isRemoteDatabase(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "::1", ""].includes(host);
  } catch {
    return false;
  }
}

const REMOTE = isRemoteDatabase();

const DEMO_PASSWORD =
  process.env.SEED_PASSWORD ?? (REMOTE ? randomBytes(12).toString("base64url") : "vionex123");

function storage(): StorageDriver {
  if (process.env.STORAGE_DRIVER === "s3") {
    const { STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET } = process.env;
    if (!STORAGE_ACCESS_KEY || !STORAGE_SECRET_KEY || !STORAGE_BUCKET) {
      throw new Error(
        "STORAGE_DRIVER=s3 exige STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY e STORAGE_BUCKET.",
      );
    }
    return createS3Driver({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION ?? "us-east-1",
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET_KEY,
      bucket: STORAGE_BUCKET,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    });
  }
  return createLocalDriver(process.env.STORAGE_LOCAL_DIR ?? "./storage");
}

async function reset() {
  // Ordered so foreign keys never block the truncate.
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "MessageRead", "Message", "MessageThread",
      "DocumentRequestReply", "DocumentRequest",
      "DocumentVersion", "Document",
      "TaskComment", "Task",
      "GtmItem", "ImportShipment", "RegulatoryItem", "ClinicalStudy",
      "Milestone", "ProjectStage", "TimelineEvent", "Project",
      "LoginAttempt", "Notification", "AuditLog", "User", "Supplier", "Organization"
    RESTART IDENTITY CASCADE;
  `);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
    console.error(
      [
        "",
        "✗ Seed bloqueado: NODE_ENV=production.",
        "",
        "  Este script APAGA todos os dados e cria usuários de demonstração.",
        "  Para criar o primeiro acesso em produção use:  npm run create-admin",
        "",
        "  Se este banco é realmente descartável, force com ALLOW_DESTRUCTIVE_SEED=1.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (REMOTE && process.env.SEED_CONFIRM !== "1") {
    const host = new URL(process.env.DATABASE_URL ?? "postgres://x").hostname;
    console.error(
      [
        "",
        `✗ DATABASE_URL aponta para um banco remoto: ${host}`,
        "",
        "  O seed APAGA todas as tabelas antes de recriar os dados — inclusive",
        "  qualquer administrador criado com create-admin.",
        "",
        "  Se é isso mesmo que você quer:  SEED_CONFIRM=1 npm run seed",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("→ Limpando dados existentes…");
  await reset();

  console.log("→ Criando dados de demonstração…");
  await seedDemoData(db, { password: DEMO_PASSWORD, storage: storage() });

  const counts = await Promise.all([
    db.project.count(),
    db.task.count(),
    db.document.count(),
    db.documentRequest.count(),
    db.user.count(),
    db.supplier.count(),
  ]);

  console.log(`
✓ Seed concluído.
  Fornecedores ........ ${counts[5]}
  Usuários ............ ${counts[4]}
  Projetos ............ ${counts[0]}
  Tarefas ............. ${counts[1]}
  Documentos .......... ${counts[2]}
  Solicitações ........ ${counts[3]}

  Senha de todos os usuários: ${DEMO_PASSWORD}

    admin@vionex.com ........ ADMIN       · Lucas Silva
    manager@vionex.com ...... MANAGER     · João Mendes
    regulatory@vionex.com ... REGULATORY  · Stefany Rocha
    marketing@vionex.com .... MARKETING   · Maria Santos
    viewer@vionex.com ....... VIEWER      · Paulo Reis
    supplier@example.com .... SUPPLIER    · John Smith (Manufacturer A)
    klaus@example.com ....... SUPPLIER    · Klaus Weber (Manufacturer B)
`);
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
