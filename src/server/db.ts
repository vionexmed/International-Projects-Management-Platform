import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";
import { createEmbeddedPool, shouldUseEmbeddedDatabase } from "@/server/demo/embedded-db";

/**
 * A single PrismaClient is reused across hot reloads in development so that
 * the dev server does not exhaust the database connection pool.
 */
/**
 * With no DATABASE_URL the application falls back to an embedded Postgres
 * (PGlite, in memory) seeded with the demo dataset, so it can be opened and
 * reviewed with no setup at all. Anything real supplies a connection string
 * and never touches that path.
 */
const createClient = () => {
  const log = process.env.NODE_ENV === "development" ? (["warn", "error"] as const) : (["error"] as const);

  if (shouldUseEmbeddedDatabase()) {
    return new PrismaClient({ adapter: new PrismaPg(createEmbeddedPool()), log: [...log] });
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: [...log],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

function client(): ReturnType<typeof createClient> {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * The client is built on first use rather than on import, because importing
 * this module happens while `next build` collects route configuration — before
 * the deployment's DATABASE_URL exists. Methods are bound to the real client
 * so `db.$transaction(...)` and friends keep their receiver.
 */
export const db = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_target, property: string | symbol) => {
    const value = client()[property as keyof ReturnType<typeof createClient>];
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
