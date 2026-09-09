"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "@/server/auth/session";
import { getCurrentUser } from "@/server/auth/current-user";
import { recordAudit } from "@/server/services/audit";
import { isSupplierRole } from "@/types/auth";
import { getDictionary } from "@/lib/i18n/dictionary";
import { DEFAULT_INTERNAL_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  remember: z.boolean(),
});

export type SignInState = { error?: string };

/**
 * A dummy hash of the same cost as a real one. Verifying against it when the
 * account does not exist keeps the response time indistinguishable, so the
 * form cannot be used to discover which e-mails are registered.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Vd0xVh9pRbXqvJdG0e5xVX5Wt1Kx4W";

/** Simple in-process throttle. Real deployments should front this with a shared store. */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function throttled(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const localeValue = String(formData.get("locale") ?? "");
  const locale: Locale = isLocale(localeValue) ? localeValue : DEFAULT_INTERNAL_LOCALE;
  const dict = getDictionary(locale);

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) {
    return { error: dict.auth.invalidCredentials };
  }

  const { email, password, remember } = parsed.data;

  if (throttled(email)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true, passwordHash: true, role: true, status: true, supplierId: true },
  });

  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches) {
    registerFailure(email);
    return { error: dict.auth.invalidCredentials };
  }

  if (user.status !== "ACTIVE") {
    return { error: dict.auth.accountInactive };
  }

  // A supplier account with no supplier link cannot be scoped safely.
  if (isSupplierRole(user.role) && !user.supplierId) {
    return { error: dict.auth.accountInactive };
  }

  attempts.delete(email);

  const { token, maxAge } = await createSessionToken(
    { id: user.id, organizationId: user.organizationId },
    remember,
  );
  await setSessionCookie(token, maxAge);

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });

  redirect(isSupplierRole(user.role) ? "/supplier" : "/dashboard");
}

export async function signOut() {
  const user = await getCurrentUser();
  if (user) {
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "auth.logout",
      entity: "User",
      entityId: user.id,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
