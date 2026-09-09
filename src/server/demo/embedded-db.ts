import { Pool, type PoolClient, type QueryResult } from "pg";
import { SCHEMA_SQL } from "@/server/demo/schema-sql";

/**
 * A Postgres that needs no Postgres.
 *
 * When `DATABASE_URL` is absent the application runs against PGlite — real
 * Postgres compiled to WebAssembly — started inside this process and exposed
 * over its socket server, which speaks the actual wire protocol. Prisma
 * connects to it exactly as it would to a managed database, so no query,
 * service or page needs to know the difference.
 *
 * This exists so the platform can be opened and reviewed with zero setup: no
 * account, no provisioning, no connection string. The data lives in memory and
 * is rebuilt from the demo seed whenever an instance starts, which is precisely
 * what a visual review wants and precisely what real use must not have.
 */
const PORT = Number(process.env.EMBEDDED_DB_PORT ?? 55432);

type Ready = { pool: Pool };

let startup: Promise<Ready> | null = null;

async function start(): Promise<Ready> {
  // Imported lazily so the WASM runtime is never loaded by a deployment that
  // has a real database.
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

  const database = await PGlite.create();
  const server = new PGLiteSocketServer({ db: database, port: PORT, host: "127.0.0.1" });
  await server.start();

  const pool = new Pool({
    host: "127.0.0.1",
    port: PORT,
    user: "postgres",
    database: "postgres",
    // PGlite's socket server serves one connection at a time; a larger pool
    // makes it drop connections mid-query. Requests queue instead, which is
    // the right trade for a demonstration.
    max: 1,
  });

  await pool.query(SCHEMA_SQL);

  const { PrismaClient } = await import("@/generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { seedDemoData } = await import("@/server/demo/seed-data");

  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  // No storage: the document rows are what a visual review needs, and files
  // written here would disappear with the database anyway.
  await seedDemoData(client, { password: "vionex123", storage: null });
  await client.$disconnect();

  return { pool };
}

/**
 * A pool that defers every operation until the embedded database is up.
 *
 * Prisma builds its adapter synchronously and queries immediately, while
 * starting PGlite is asynchronous — so rather than racing, each call waits for
 * the one-time startup to settle. Startup runs once per process.
 */
class EmbeddedPool extends Pool {
  private ready(): Promise<Ready> {
    startup ??= start();
    return startup;
  }

  override async connect(): Promise<PoolClient> {
    const { pool } = await this.ready();
    return pool.connect();
  }

  override async query(...args: unknown[]): Promise<QueryResult> {
    const { pool } = await this.ready();
    return (pool.query as (...a: unknown[]) => Promise<QueryResult>)(...args);
  }

  override async end(): Promise<void> {
    if (!startup) return;
    const { pool } = await startup;
    await pool.end();
  }
}

/** True when no database was configured, so the embedded one should be used. */
export function shouldUseEmbeddedDatabase(): boolean {
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "";
}

export function createEmbeddedPool(): Pool {
  return new EmbeddedPool();
}
