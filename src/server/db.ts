import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";

/**
 * A single PrismaClient is reused across hot reloads in development so that
 * the dev server does not exhaust the database connection pool.
 */
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

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
