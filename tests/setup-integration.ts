import "./setup";
import { Client } from "pg";

/**
 * Refuses to run the integration suite unless the database is actually there.
 *
 * The previous guard checked that `DATABASE_URL` was *set*, which is a
 * different question and the wrong one: the variable is in `.env` on every
 * machine, so it was satisfied even with Postgres stopped. What happened then
 * was worse than a failure — `beforeAll` threw, Vitest skipped the bodies, and
 * the run ended reporting passes while the supplier-isolation suite had not
 * asserted anything at all.
 *
 * A suite that quietly does not run is more dangerous than no suite, because
 * it is trusted. This connects, or the run stops and says why.
 */
const TIMEOUT_MS = 5_000;

export async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for the integration suite. Run `npm run db:start` first.",
    );
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: TIMEOUT_MS });

  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The integration suite needs a reachable database and could not connect.\n` +
        `  reason: ${reason}\n` +
        `  fix:    npm run db:start\n\n` +
        `Refusing to continue: these tests prove supplier isolation, and a run ` +
        `that skips them would report success without having checked anything.`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}
