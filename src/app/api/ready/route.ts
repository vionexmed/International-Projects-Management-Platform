import { NextResponse } from "next/server";

/**
 * Readiness — "should this instance receive traffic?"
 *
 * Distinct from `/api/health`, and the distinction is operational, not
 * cosmetic. Liveness asks whether the process is alive: if it answers no, the
 * platform restarts it. Readiness asks whether it can serve *correctly*: if it
 * answers no, the platform stops sending traffic but leaves the instance
 * running. Restarting an instance whose database is briefly unreachable makes
 * an outage longer, not shorter — so the two must not share an endpoint.
 *
 * Checked here: the environment contract, the database, the migration state,
 * persistent storage, and that no demonstration shortcut is enabled. Each one
 * is something that makes the answers wrong rather than absent.
 *
 * The response names which check failed and never why in detail — an unauthed
 * probe endpoint is not the place to describe the shape of a deployment.
 */
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail?: string };

export async function GET() {
  const startedAt = Date.now();
  const noStore = { "Cache-Control": "no-store" } as const;
  const checks: Check[] = [];

  const { appEnv, allowsDemo, isRealEnvironment } = await import("@/lib/app-env");
  const { startupProblems } = await import("@/lib/startup-check");

  const problems = startupProblems();
  const fatal = problems.filter((problem) => problem.severity === "fatal");
  checks.push({
    name: "environment",
    ok: fatal.length === 0,
    // Variable names only. Never values.
    detail: fatal.length > 0 ? fatal.map((problem) => problem.variable).join(", ") : undefined,
  });

  checks.push({
    name: "demo-disabled",
    ok: !isRealEnvironment() || !allowsDemo(),
  });

  /**
   * The database has to be reachable *and* migrated. An empty database
   * accepts connections happily and fails every query — which looks like a
   * working deployment right up until the first person opens a page.
   */
  if (fatal.length === 0) {
    try {
      const { db } = await import("@/server/db");
      await db.$queryRaw`SELECT 1`;
      checks.push({ name: "database", ok: true });

      try {
        const applied = await db.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "_prisma_migrations"
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        `;
        const count = Number(applied[0]?.count ?? 0);
        checks.push({
          name: "migrations",
          ok: count > 0,
          detail: count > 0 ? `${count} applied` : "no migrations applied",
        });
      } catch {
        // No `_prisma_migrations` table at all: the database has never been
        // migrated, which is a different failure from "cannot count them".
        checks.push({ name: "migrations", ok: false, detail: "migration history missing" });
      }
    } catch {
      checks.push({ name: "database", ok: false, detail: "unreachable" });
    }
  } else {
    checks.push({ name: "database", ok: false, detail: "not checked" });
  }

  const { env } = await import("@/lib/env").catch(() => ({ env: null }) as never);
  const persistentStorage = env?.STORAGE_DRIVER === "s3";
  checks.push({
    name: "storage",
    ok: persistentStorage || !["staging", "production"].includes(appEnv()),
    detail: persistentStorage ? "s3" : "local",
  });

  const ready = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      status: ready ? "ready" : "not-ready",
      environment: appEnv(),
      checks,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: noStore },
  );
}
