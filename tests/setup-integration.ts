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

  /**
   * And refuses to run against a database that is not obviously disposable.
   *
   * These tests write: every file creates an organisation, projects,
   * documents and users, and deletes them afterwards. That is exactly right
   * against a local Postgres and exactly wrong against the managed database
   * that now sits behind the same variable name — one `npm run test:integration`
   * with a staging URL in `.env` writes test fixtures into a real environment.
   *
   * Localhost is allowed without ceremony. Anything else has to be declared,
   * which makes the dangerous case a decision instead of an accident. CI
   * connects to a service container on localhost and is unaffected.
   */
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(host);

  if (!local && process.env.ALLOW_REMOTE_TEST_DATABASE !== "yes") {
    throw new Error(
      `The integration suite writes to the database it is pointed at, and ` +
        `DATABASE_URL points at "${host}", which is not local.\n\n` +
        `  If that is a throwaway database, re-run with ` +
        `ALLOW_REMOTE_TEST_DATABASE=yes.\n` +
        `  If it is staging or production, point DATABASE_URL at the local ` +
        `Postgres instead (npm run db:start).`,
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
