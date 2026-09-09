import { headers } from "next/headers";
import { db } from "@/server/db";

/**
 * Sign-in throttling backed by the database.
 *
 * Both the e-mail and the client IP are counted, so neither spraying one
 * password across many accounts nor hammering one account slips through. The
 * counters live in Postgres because an in-process counter is per-instance:
 * on serverless or any multi-replica deployment it is trivially bypassed by
 * spreading attempts across instances.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 20;

/**
 * Best-effort client address, read from the proxy headers the platform sets.
 * Callers pass the result into the functions below rather than having them
 * reach for request state themselves, which keeps the throttle a pure
 * function of its inputs and therefore testable.
 */
export async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return store.get("x-real-ip") ?? null;
}

export type ThrottleVerdict = { blocked: boolean; retryAfterMinutes: number };

/**
 * Reports whether this e-mail or address has exhausted its attempts. Failures
 * are swallowed: a throttle outage must not lock everyone out of the product.
 */
export async function checkLoginThrottle(
  email: string,
  ip: string | null,
): Promise<ThrottleVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);

  const keys = [`email:${email}`, ...(ip ? [`ip:${ip}`] : [])];

  try {
    const grouped = await db.loginAttempt.groupBy({
      by: ["key"],
      where: { key: { in: keys }, createdAt: { gte: since } },
      _count: { _all: true },
    });

    const counts = new Map(grouped.map((row) => [row.key, row._count._all]));
    const byEmail = counts.get(`email:${email}`) ?? 0;
    const byIp = ip ? (counts.get(`ip:${ip}`) ?? 0) : 0;

    const blocked = byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
    return { blocked, retryAfterMinutes: Math.ceil(WINDOW_MS / 60_000) };
  } catch (error) {
    console.error("[throttle] check failed, allowing attempt", error);
    return { blocked: false, retryAfterMinutes: 0 };
  }
}

/** Records one failed attempt against both keys. */
export async function recordFailedLogin(email: string, ip: string | null): Promise<void> {
  try {
    await db.loginAttempt.createMany({
      data: [{ key: `email:${email}` }, ...(ip ? [{ key: `ip:${ip}` }] : [])],
    });

    // Opportunistic cleanup so the table cannot grow without bound; no cron
    // job needed for a table only written on failure.
    if (Math.random() < 0.05) {
      await db.loginAttempt.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS * 6) } },
      });
    }
  } catch (error) {
    console.error("[throttle] failed to record attempt", error);
  }
}

/** Clears the e-mail's attempts after a successful sign-in. */
export async function clearLoginThrottle(email: string): Promise<void> {
  try {
    await db.loginAttempt.deleteMany({ where: { key: `email:${email}` } });
  } catch (error) {
    console.error("[throttle] failed to clear attempts", error);
  }
}
