import { NextResponse } from "next/server";
import { environmentIssues } from "@/lib/env-schema";

/**
 * Liveness probe, and the first thing to check after a fresh deploy.
 *
 * It reports three distinct states rather than just up/down, because they call
 * for different fixes:
 *
 *   misconfigured — required variables are missing or invalid (503)
 *   degraded      — configured, but the database is unreachable (503)
 *   ok            — serving (200)
 *
 * When misconfigured it names the offending variables. Only names, never
 * values: the point is to turn an opaque 500 into something actionable, not to
 * expose configuration. Once the app is healthy the response carries no
 * detail at all.
 *
 * Both `env` and the database client are imported lazily, since importing
 * them is exactly what fails when the configuration is wrong.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const noStore = { "Cache-Control": "no-store" } as const;

  const issues = environmentIssues();
  if (issues.length > 0) {
    return NextResponse.json(
      {
        status: "misconfigured",
        message: "Required environment variables are missing or invalid.",
        variables: issues,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: noStore },
    );
  }

  try {
    const { db } = await import("@/server/db");
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("[health] database unreachable", error);

    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: noStore },
    );
  }
}
