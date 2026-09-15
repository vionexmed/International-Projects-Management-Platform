import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { createSessionToken, SESSION_COOKIE } from "@/server/auth/session";
import { isSupplierRole } from "@/types/auth";
import { isDemoEnabled } from "@/lib/demo";

/**
 * One-click entry for a demonstration deployment.
 *
 * It mints the same signed session a real login produces, for a seeded
 * account, so every permission check, scope and isolation rule behaves exactly
 * as in production — only the password step is skipped.
 *
 * Available in development, and in a deployment that sets DEMO_MODE. Anywhere
 * else it is a 404, so it cannot be reached by accident.
 */
const DEMO_ACCOUNTS: Record<string, string> = {
  admin: "admin@vionex.com",
  manager: "manager@vionex.com",
  regulatory: "regulatory@vionex.com",
  marketing: "marketing@vionex.com",
  viewer: "viewer@vionex.com",
  supplier: "supplier@example.com",
  "supplier-user": "supplier.user@example.com",
  klaus: "klaus@example.com",
  emily: "emily@example.com",
};

export async function GET(request: Request) {
  if (!isDemoEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const email = DEMO_ACCOUNTS[params.get("as") ?? "admin"];

  if (!email) {
    return NextResponse.json(
      { error: "Conta desconhecida.", available: Object.keys(DEMO_ACCOUNTS) },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true, role: true, status: true, supplierId: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Usuário ${email} não encontrado. Rode \`npm run seed\`.` },
      { status: 404 },
    );
  }

  const { token, maxAge } = await createSessionToken(
    { id: user.id, organizationId: user.organizationId },
    false,
  );

  const destination = params.get("to") ?? (isSupplierRole(user.role) ? "/supplier" : "/dashboard");
  const safeDestination = destination.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/dashboard";

  const response = NextResponse.redirect(new URL(safeDestination, request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}
