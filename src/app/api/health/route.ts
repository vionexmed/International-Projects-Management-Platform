import { NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * Liveness/readiness probe for load balancers and uptime monitoring.
 *
 * It checks the database round-trip, because an instance that cannot reach
 * Postgres is not actually serving. Deliberately unauthenticated — it exposes
 * no data beyond up/down — and never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
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
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
