import { Pool, type PoolClient, type QueryResult } from "pg";
import { allowsDemo, appEnv } from "@/lib/app-env";

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

  /**
   * The database is restored from a snapshot built at build time rather than
   * being created and seeded here. Creating the schema and inserting the whole
   * demo dataset on every instance made each cold start pay for work that
   * never changes — and a demo that is clicked occasionally starts new
   * instances constantly.
   */
  const { DEMO_SNAPSHOT_BASE64 } = await import("@/server/demo/snapshot/data");
  if (!DEMO_SNAPSHOT_BASE64) {
    // The module is written empty by builds outside development, test and
    // demo. Reaching here means a demonstration was asked of a bundle that
    // deliberately does not carry one.
    throw new Error(
      `This build carries no demonstration data (APP_ENV was "${appEnv()}" at ` +
        "build time). Set DATABASE_URL, or build with APP_ENV=demo.",
    );
  }
  const snapshot = new Blob([Buffer.from(DEMO_SNAPSHOT_BASE64, "base64")]);

  const database = await PGlite.create({ loadDataDir: snapshot });
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
/**
 * Whether to run on the embedded database.
 *
 * Two conditions, and the order matters. The environment has to *allow* a
 * demonstration at all; only then does an absent `DATABASE_URL` mean "use the
 * embedded one". Reversing that — which is what this used to do — makes a
 * blank variable in a real deployment silently swap the database for one full
 * of invented data whose passwords are published in this repository.
 *
 * A real environment that reaches this function with no database URL is
 * misconfigured, and says so instead of improvising.
 */
export function shouldUseEmbeddedDatabase(): boolean {
  const absent = !process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "";
  if (!absent) return false;

  if (!allowsDemo()) {
    throw new Error(
      `DATABASE_URL is not set and APP_ENV is "${appEnv()}". The embedded ` +
        "demonstration database carries seeded accounts with published " +
        "passwords and is refused outside development, test and demo.",
    );
  }

  return true;
}

export function createEmbeddedPool(): Pool {
  return new EmbeddedPool();
}
