import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "@/lib/env";
import type { SessionUser } from "@/types/auth";

export const SESSION_COOKIE = "vionex_session";

const SHORT_SESSION_SECONDS = 60 * 60 * 8; // 8 hours
const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Derived on demand so importing this module needs no configuration. */
function signingKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

const payloadSchema = z.object({
  sub: z.string().min(1),
  org: z.string().min(1),
});

/**
 * The cookie carries only identifiers. Roles and supplier scoping are always
 * re-read from the database so that a revoked or downgraded account cannot
 * keep acting on a stale token.
 */
export async function createSessionToken(user: Pick<SessionUser, "id" | "organizationId">, remember: boolean) {
  const maxAge = remember ? REMEMBERED_SESSION_SECONDS : SHORT_SESSION_SECONDS;
  const token = await new SignJWT({ org: user.organizationId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer("vionex-projects")
    .setExpirationTime(`${maxAge}s`)
    .sign(signingKey());

  return { token, maxAge };
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { issuer: "vionex-projects" });
    const parsed = payloadSchema.safeParse(payload);
    return parsed.success ? { userId: parsed.data.sub, organizationId: parsed.data.org } : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, maxAge: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
